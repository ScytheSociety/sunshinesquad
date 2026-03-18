const express  = require("express");
const router   = express.Router();
const { botDB } = require("../db/bot");

// GET /api/clan/:game
// Devuelve los miembros del clan para un juego específico
// Busca en game_info por nombre parcial (case-insensitive)
router.get("/:game", (req, res) => {
  try {
    const db      = botDB();
    const gameKey = req.params.game.toLowerCase();

    // Mapeo de game key → posibles nombres en la DB del bot
    const GAME_NAMES = {
      ragnarok:        ["ragnarok", "ro"],
      wow:             ["world of warcraft", "wow"],
      lineage2:        ["lineage", "l2"],
      brawlstars:      ["brawl"],
      throneandliberty:["throne", "liberty", "tl"],
    };

    const keywords = GAME_NAMES[gameKey] || [gameKey];

    // Buscar game_id(s) que coincidan con alguna keyword
    const allGames = db.prepare("SELECT id, name FROM game_info").all();
    const matchIds = allGames
      .filter(g => keywords.some(k => g.name.toLowerCase().includes(k)))
      .map(g => g.id);

    if (!matchIds.length) {
      return res.json([]);
    }

    const placeholders = matchIds.map(() => "?").join(",");

    const rows = db.prepare(`
      SELECT
        u.discord_user_id,
        u.display_name   AS username,
        SUM(ugs.points)  AS puntos,
        g.name           AS game_name
      FROM user_game_stats ugs
      JOIN users u     ON ugs.user_id = u.id
      JOIN game_info g ON ugs.game_id = g.id
      WHERE ugs.game_id IN (${placeholders})
      GROUP BY ugs.user_id
      ORDER BY puntos DESC
      LIMIT 50
    `).all(...matchIds);

    const result = rows.map(r => {
      const characters = db.prepare(`
        SELECT c.character_name, c.level, c.is_main, c.points,
               COALESCE(cl.name,'') as class_name, COALESCE(cl.emoji,'') as class_emoji,
               COALESCE(ro.name,'') as role_name, COALESCE(ro.emoji,'') as role_emoji
        FROM characters c
        LEFT JOIN classes cl ON cl.id = c.class_id
        LEFT JOIN roles ro   ON ro.id = c.role_id
        WHERE c.discord_user_id = ? AND c.game_id IN (${placeholders}) AND c.is_active = 1
        ORDER BY c.is_main DESC, c.points DESC
        LIMIT 5
      `).all(r.discord_user_id, ...matchIds);
      return {
        discord_id: r.discord_user_id,
        username:   r.username,
        puntos:     r.puntos,
        avatar_url: null,
        rank_name:  null,
        characters,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("clan:", err);
    res.status(500).json({ error: "Error al obtener miembros" });
  }
});

module.exports = router;
