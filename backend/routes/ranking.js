const express  = require("express");
const router   = express.Router();
const { botDB } = require("../db/bot");
const { webDB } = require("../db/web");

// GET /api/ranking?limit=20&game=ro
router.get("/", (req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=60");
    const db    = botDB();
    const web   = webDB();
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const game  = req.query.game || null;

    let top;
    if (game) {
      top = db.prepare(`
        SELECT
          u.id            AS uid,
          u.discord_user_id,
          u.display_name  AS username,
          ugs.points      AS puntos_totales
        FROM user_game_stats ugs
        JOIN users u     ON ugs.user_id = u.id
        JOIN game_info g ON ugs.game_id = g.id
        WHERE g.command_key = ?
        ORDER BY puntos_totales DESC,
                 COALESCE(u.server_join_date, u.created_at) ASC
        LIMIT ?
      `).all(game, limit);
    } else {
      top = db.prepare(`
        SELECT
          u.id            AS uid,
          u.discord_user_id,
          u.display_name  AS username,
          SUM(ugs.points) AS puntos_totales
        FROM user_game_stats ugs
        JOIN users u ON ugs.user_id = u.id
        GROUP BY ugs.user_id
        ORDER BY puntos_totales DESC,
                 COALESCE(u.server_join_date, u.created_at) ASC
        LIMIT ?
      `).all(limit);
    }

    const result = top.map((u, i) => {
      const juegos = db.prepare(`
        SELECT g.name AS game, g.command_key, COALESCE(g.emoji,'🎮') as emoji, ugs.points
        FROM user_game_stats ugs
        JOIN game_info g ON ugs.game_id = g.id
        WHERE ugs.user_id = ? AND g.is_active = 1
        ORDER BY ugs.points DESC
      `).all(u.uid);

      const logros = db.prepare(`
        SELECT a.name, a.description, COALESCE(a.emoji,'🏆') AS icon
        FROM user_achievements ua
        JOIN achievements a ON ua.achievement_id = a.id
        WHERE ua.user_id = ?
        ORDER BY ua.created_at DESC
        LIMIT 5
      `).all(u.uid);

      // Try to get cached avatar/banner from web.db
      const cached = web.prepare(
        "SELECT avatar, banner_url FROM discord_users WHERE discord_id = ?"
      ).get(u.discord_user_id);

      let avatar_url = cached?.avatar || null;
      if (!avatar_url) {
        try {
          avatar_url = `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(u.discord_user_id) % 6n)}.png`;
        } catch { avatar_url = "https://cdn.discordapp.com/embed/avatars/0.png"; }
      }

      return {
        posicion:       i + 1,
        discord_id:     u.discord_user_id,
        username:       u.username,
        avatar_url,
        banner_url:     cached?.banner_url || null,
        puntos_totales: u.puntos_totales,
        juegos,
        logros,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("ranking:", err);
    res.status(500).json({ error: "Error al obtener ranking" });
  }
});

module.exports = router;
