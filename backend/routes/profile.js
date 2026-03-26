const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const { botDB } = require("../db/bot");
const { webDB } = require("../db/web");

const router = Router();

// Construye un mapa { command_key → site_icon_url } desde game_server_config (web DB)
function getGameIconMap(web) {
  try {
    const siteGames = web.prepare(
      "SELECT bot_command_key, url FROM site_games WHERE bot_command_key IS NOT NULL AND url != ''"
    ).all();
    const ckToGameKey = {};
    siteGames.forEach(sg => {
      const m = sg.url?.match(/juegos\/([^/]+)\//);
      if (m) ckToGameKey[sg.bot_command_key] = m[1];
    });
    const gameKeys = [...new Set(Object.values(ckToGameKey))];
    if (!gameKeys.length) return {};
    const icons = {};
    web.prepare(
      `SELECT game_key, icon_url FROM game_server_config WHERE game_key IN (${gameKeys.map(() => "?").join(",")}) AND icon_url != ''`
    ).all(...gameKeys).forEach(r => { icons[r.game_key] = r.icon_url; });
    const result = {};
    Object.entries(ckToGameKey).forEach(([ck, gk]) => { if (icons[gk]) result[ck] = icons[gk]; });
    return result;
  } catch { return {}; }
}

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

  // Adjuntar icon_url gestionado desde multimedia
  const iconMap = getGameIconMap(web);
  gameStats.forEach(gs => { gs.site_icon_url = iconMap[gs.command_key] || null; });

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
    res.set("Cache-Control", "public, max-age=30");
    const bot = botDB();
    const web = webDB();
    const game = req.query.game || null;

    let users;
    if (game) {
      // Incluir tanto usuarios con stats como con personajes para este juego
      users = bot.prepare(`
        SELECT DISTINCT u.discord_user_id, u.display_name, u.created_at,
               COALESCE(pts.total_points, 0) as total_points,
               COALESCE(pts.game_count, 0) as game_count
        FROM (
          SELECT ugs.user_id
          FROM user_game_stats ugs
          JOIN game_info gi ON gi.id = ugs.game_id
          WHERE gi.command_key = ?
          UNION
          SELECT u2.id
          FROM characters c
          JOIN users u2 ON u2.discord_user_id = c.discord_user_id
          JOIN game_info gi ON gi.id = c.game_id
          WHERE gi.command_key = ? AND c.is_active = 1
        ) src
        JOIN users u ON u.id = src.user_id
        LEFT JOIN (
          SELECT user_id,
                 COALESCE(SUM(points), 0) as total_points,
                 COUNT(DISTINCT game_id) as game_count
          FROM user_game_stats GROUP BY user_id
        ) pts ON pts.user_id = u.id
        ORDER BY total_points DESC
      `).all(game, game);
    } else {
      users = bot.prepare(`
        SELECT u.discord_user_id, u.display_name, u.created_at,
               COALESCE(SUM(ugs.points),0) as total_points,
               COUNT(DISTINCT ugs.game_id) as game_count
        FROM users u LEFT JOIN user_game_stats ugs ON ugs.user_id = u.id
        GROUP BY u.id ORDER BY total_points DESC
      `).all();
    }

    // Obtener avatares en batch
    const discordIds = users.map(u => u.discord_user_id);
    const webUsers = {};
    if (discordIds.length) {
      web.prepare(
        `SELECT discord_id, username, avatar FROM discord_users WHERE discord_id IN (${discordIds.map(() => "?").join(",")})`
      ).all(...discordIds).forEach(d => { webUsers[d.discord_id] = d; });
    }

    // Obtener juegos de todos los usuarios en una sola query
    const allGames = bot.prepare(`
      SELECT ugs.user_id, gi.name, gi.command_key, COALESCE(gi.emoji,'🎮') as emoji, ugs.points
      FROM user_game_stats ugs
      JOIN game_info gi ON gi.id = ugs.game_id
      WHERE gi.is_active = 1
      ORDER BY ugs.points DESC
    `).all();
    const iconMap = getGameIconMap(web);
    const gamesByUserId = {};
    allGames.forEach(g => {
      if (!gamesByUserId[g.user_id]) gamesByUserId[g.user_id] = [];
      if (gamesByUserId[g.user_id].length < 4)
        gamesByUserId[g.user_id].push({ ...g, site_icon_url: iconMap[g.command_key] || null });
    });

    // Mapa discord_user_id → user.id (batch)
    const userIdMap = {};
    if (discordIds.length) {
      bot.prepare(
        `SELECT id, discord_user_id FROM users WHERE discord_user_id IN (${discordIds.map(() => "?").join(",")})`
      ).all(...discordIds).forEach(r => { userIdMap[r.discord_user_id] = r.id; });
    }

    // Main character per user for the filtered game
    const mainCharsMap = {};
    if (game && discordIds.length) {
      bot.prepare(`
        SELECT c.discord_user_id, c.character_name, c.level,
               COALESCE(cl.name,'') as class_name, COALESCE(cl.emoji,'') as class_emoji
        FROM characters c
        JOIN game_info gi ON gi.id = c.game_id
        LEFT JOIN classes cl ON cl.id = c.class_id
        WHERE gi.command_key = ? AND c.is_active = 1
        ORDER BY c.is_main DESC, c.points DESC
      `).all(game).forEach(c => {
        if (!mainCharsMap[c.discord_user_id]) mainCharsMap[c.discord_user_id] = c;
      });
    }

    const enriched = users.map(u => {
      const d = webUsers[u.discord_user_id];
      const uid = userIdMap[u.discord_user_id];
      return {
        discord_id:     u.discord_user_id,
        username:       d?.username || u.display_name || `User${u.discord_user_id.slice(-4)}`,
        display_name:   u.display_name,
        avatar:         d?.avatar   || defaultAvatar(u.discord_user_id),
        joined_bot:     u.created_at,
        total_points:   u.total_points,
        game_count:     u.game_count,
        games:          uid ? (gamesByUserId[uid] || []) : [],
        main_character: game ? (mainCharsMap[u.discord_user_id] || null) : null,
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
    res.set("Cache-Control", "public, max-age=30");
    const profile = buildProfile(req.params.discord_id);
    if (!profile) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(profile);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
