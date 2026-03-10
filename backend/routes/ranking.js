const express  = require("express");
const router   = express.Router();
const { botDB } = require("../db/bot");

// GET /api/ranking?limit=5
router.get("/", (req, res) => {
  try {
    const db    = botDB();
    const limit = Math.min(parseInt(req.query.limit) || 5, 50);

    const top = db.prepare(`
      SELECT
        u.id            AS uid,
        u.discord_user_id,
        u.display_name  AS username,
        SUM(ugs.points) AS puntos_totales
      FROM user_game_stats ugs
      JOIN users u ON ugs.user_id = u.id
      GROUP BY ugs.user_id
      ORDER BY puntos_totales DESC
      LIMIT ?
    `).all(limit);

    const result = top.map((u, i) => {
      const juegos = db.prepare(`
        SELECT g.name AS game, ugs.points
        FROM user_game_stats ugs
        JOIN game_info g ON ugs.game_id = g.id
        WHERE ugs.user_id = ?
        ORDER BY ugs.points DESC
      `).all(u.uid);

      const logros = db.prepare(`
        SELECT a.name, a.description, a.emoji AS icon
        FROM user_achievements ua
        JOIN achievements a ON ua.achievement_id = a.id
        WHERE ua.user_id = ?
        ORDER BY ua.created_at DESC
        LIMIT 5
      `).all(u.uid);

      return {
        posicion:       i + 1,
        discord_id:     u.discord_user_id,
        username:       u.username,
        avatar_url:     null,   // bot DB no almacena avatar; el frontend puede resolverlo
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
