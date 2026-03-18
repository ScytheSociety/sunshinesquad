const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const { botDB } = require("../db/bot");
const { webDB } = require("../db/web");

const router = Router();

function defaultAvatar(discord_id) {
  try { return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(discord_id) % 6n)}.png`; }
  catch { return `https://cdn.discordapp.com/embed/avatars/0.png`; }
}

function buildProfile(discord_id) {
  const bot = botDB();
  const web = webDB();

  const user = bot.prepare("SELECT * FROM users WHERE discord_user_id=?").get(discord_id);
  if (!user) return null;

  const cached = web.prepare("SELECT username, avatar, banner_url FROM discord_users WHERE discord_id=?").get(discord_id);

  const gameStats = bot.prepare(`
    SELECT gi.id, gi.name, gi.abbreviation, gi.command_key,
           COALESCE(gi.emoji,'🎮') as emoji, gi.color, gi.icon_url, ugs.points
    FROM user_game_stats ugs
    JOIN game_info gi ON gi.id = ugs.game_id
    WHERE ugs.user_id = ? AND gi.is_active = 1
    ORDER BY ugs.points DESC
  `).all(user.id);

  // Añadir juegos donde tiene personajes pero no stats
  const charGames = bot.prepare(`
    SELECT DISTINCT gi.id, gi.name, gi.abbreviation, gi.command_key,
           COALESCE(gi.emoji,'🎮') as emoji, gi.color, gi.icon_url
    FROM characters c
    JOIN game_info gi ON gi.id = c.game_id
    WHERE c.discord_user_id = ? AND c.is_active = 1 AND gi.is_active = 1
  `).all(discord_id);

  charGames.forEach(cg => {
    if (!gameStats.some(gs => gs.id === cg.id)) {
      gameStats.push({ ...cg, points: 0 });
    }
  });

  const characters = bot.prepare(`
    SELECT c.character_name, c.level, c.is_main, c.points,
           COALESCE(cl.name,'') as class_name, COALESCE(cl.emoji,'') as class_emoji,
           COALESCE(r.name,'') as role_name, COALESCE(r.emoji,'') as role_emoji,
           gi.name as game_name, gi.command_key, gi.abbreviation,
           COALESCE(cl2.name,'') as clan_name
    FROM characters c
    JOIN game_info gi ON gi.id = c.game_id
    LEFT JOIN classes cl  ON cl.id  = c.class_id
    LEFT JOIN roles r     ON r.id   = c.role_id
    LEFT JOIN clans cl2   ON cl2.id = c.clan_id
    WHERE c.discord_user_id = ? AND c.is_active = 1
    ORDER BY c.is_main DESC, c.points DESC
  `).all(discord_id);

  const achievements = bot.prepare(`
    SELECT a.name, a.description, a.points, COALESCE(a.emoji,'🏆') as emoji,
           gi.name as game_name, gi.command_key, ua.created_at
    FROM user_achievements ua
    JOIN users u  ON u.id = ua.user_id
    JOIN achievements a ON a.id = ua.achievement_id
    JOIN game_info gi   ON gi.id = a.game_id
    WHERE u.discord_user_id = ?
    ORDER BY ua.created_at DESC
  `).all(discord_id);

  const eventsAttended = bot.prepare(`
    SELECT e.name, e.event_datetime, gi.name as game_name,
           gi.command_key, er.status
    FROM event_registrations er
    JOIN events e    ON e.id = er.event_id
    JOIN game_info gi ON gi.id = e.game_id
    WHERE er.discord_user_id = ? AND er.attended = 1
    ORDER BY e.event_datetime DESC LIMIT 10
  `).all(discord_id);

  const totalPoints = gameStats.reduce((s, g) => s + (g.points || 0), 0);

  let rank = null;
  try {
    const rr = bot.prepare(`
      SELECT rnk FROM (
        SELECT u.discord_user_id, ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ugs.points),0) DESC) as rnk
        FROM users u LEFT JOIN user_game_stats ugs ON ugs.user_id = u.id GROUP BY u.id
      ) WHERE discord_user_id = ?
    `).get(discord_id);
    rank = rr?.rnk ?? null;
  } catch {}

  return {
    discord_id,
    username:        cached?.username || user.display_name || `User${discord_id.slice(-4)}`,
    display_name:    user.display_name,
    avatar:          cached?.avatar   || defaultAvatar(discord_id),
    banner_url:      cached?.banner_url || null,
    timezone:        user.timezone,
    joined_bot:      user.created_at,
    total_points:    totalPoints,
    rank,
    game_stats:      gameStats,
    characters,
    achievements,
    events_attended: eventsAttended,
  };
}

// PUT /api/profile/banner — actualizar banner (requiere auth)
router.put("/banner", requireAuth, (req, res) => {
  try {
    const { banner_url } = req.body;
    webDB().prepare(
      "UPDATE discord_users SET banner_url=? WHERE discord_id=?"
    ).run(banner_url || null, req.user.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/profile/members — directorio público
router.get("/members", (req, res) => {
  try {
    const bot = botDB();
    const web = webDB();
    const game = req.query.game || null;

    let users;
    if (game) {
      users = bot.prepare(`
        SELECT u.discord_user_id, u.display_name, u.created_at,
               COALESCE(SUM(ugs.points),0) as total_points,
               COUNT(DISTINCT ugs.game_id) as game_count
        FROM users u
        JOIN user_game_stats ugs ON ugs.user_id = u.id
        JOIN game_info gi ON gi.id = ugs.game_id
        WHERE gi.command_key = ?
        GROUP BY u.id ORDER BY total_points DESC
      `).all(game);
    } else {
      users = bot.prepare(`
        SELECT u.discord_user_id, u.display_name, u.created_at,
               COALESCE(SUM(ugs.points),0) as total_points,
               COUNT(DISTINCT ugs.game_id) as game_count
        FROM users u LEFT JOIN user_game_stats ugs ON ugs.user_id = u.id
        GROUP BY u.id ORDER BY total_points DESC
      `).all();
    }

    const enriched = users.map(u => {
      const d = web.prepare("SELECT username, avatar FROM discord_users WHERE discord_id=?").get(u.discord_user_id);
      // Juegos activos del usuario
      const games = bot.prepare(`
        SELECT gi.name, gi.command_key, COALESCE(gi.emoji,'🎮') as emoji, ugs.points
        FROM user_game_stats ugs
        JOIN game_info gi ON gi.id = ugs.game_id
        WHERE ugs.user_id = (SELECT id FROM users WHERE discord_user_id=?) AND gi.is_active=1
        ORDER BY ugs.points DESC LIMIT 4
      `).all(u.discord_user_id);
      return {
        discord_id:   u.discord_user_id,
        username:     d?.username || u.display_name || `User${u.discord_user_id.slice(-4)}`,
        display_name: u.display_name,
        avatar:       d?.avatar   || defaultAvatar(u.discord_user_id),
        joined_bot:   u.created_at,
        total_points: u.total_points,
        game_count:   u.game_count,
        games,
      };
    });

    res.json(enriched.filter(m => !/^User\d+$/.test(m.username)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/profile/me — mi perfil (requiere auth)
router.get("/me", requireAuth, (req, res) => {
  try {
    const profile = buildProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: "No registrado en el bot todavía" });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/profile/:discord_id — perfil público
router.get("/:discord_id", (req, res) => {
  try {
    const profile = buildProfile(req.params.discord_id);
    if (!profile) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
