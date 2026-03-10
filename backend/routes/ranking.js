const express  = require("express");
const router   = express.Router();
const { botDB } = require("../db/bot");

// GET /api/ranking?limit=5
router.get("/", (req, res) => {
  try {
    const db    = botDB();
    const limit = Math.min(parseInt(req.query.limit) || 5, 50);

    // Top usuarios por puntos totales
    const top = db.prepare(`
      SELECT
        u.discord_id,
        u.username,
        u.avatar_url,
        SUM(ugs.points) AS puntos_totales
      FROM user_game_stats ugs
      JOIN users u ON ugs.discord_id = u.discord_id
      GROUP BY ugs.discord_id
      ORDER BY puntos_totales DESC
      LIMIT ?
    `).all(limit);

    // Para cada usuario, obtener desglose por juego y logros
    const result = top.map((u, idx) => {
      const juegos = db.prepare(`
        SELECT game, points, rank_name
        FROM user_game_stats
        WHERE discord_id = ?
        ORDER BY points DESC
      `).all(u.discord_id);

      const logros = db.prepare(`
        SELECT a.name, a.description, a.icon
        FROM user_achievements ua
        JOIN achievements a ON ua.achievement_id = a.id
        WHERE ua.discord_id = ?
        ORDER BY ua.earned_at DESC
        LIMIT 5
      `).all(u.discord_id);

      return {
        posicion: idx + 1,
        discord_id:    u.discord_id,
        username:      u.username,
        avatar_url:    u.avatar_url,
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
