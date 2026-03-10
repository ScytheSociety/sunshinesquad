const express  = require("express");
const router   = express.Router();
const { botDB } = require("../db/bot");

// GET /api/mvp
router.get("/", (req, res) => {
  try {
    const db = botDB();
    const mvps = db.prepare(`
      SELECT
        mk.id,
        mb.nombre        AS boss_name,
        mk.death_time    AS killed_at,
        mk.respawn_time  AS respawn_at,
        mk.status,
        mk.navigation,
        mb.hora_respawn,
        mb.nombre_mapa   AS map,
        mb.imagen        AS image_url,
        mb.categoria,
        mb.navegacion    AS nav_code
      FROM mvp_kills mk
      LEFT JOIN mvp_bosses mb ON mk.mvp_id = mb.id
      WHERE mk.status = 'active'
      ORDER BY mk.respawn_time ASC
      LIMIT 20
    `).all();
    res.json(mvps);
  } catch (err) {
    console.error("mvp:", err);
    res.status(500).json({ error: "Error al obtener MVPs" });
  }
});

// GET /api/mvp/next
router.get("/next", (req, res) => {
  try {
    const db  = botDB();
    const now = new Date().toISOString();
    const mvp = db.prepare(`
      SELECT
        mb.nombre       AS boss_name,
        mk.respawn_time AS respawn_at,
        mk.status,
        mk.navigation,
        mb.nombre_mapa  AS map,
        mb.imagen       AS image_url,
        mb.hora_respawn
      FROM mvp_kills mk
      LEFT JOIN mvp_bosses mb ON mk.mvp_id = mb.id
      WHERE mk.status = 'active' AND mk.respawn_time > ?
      ORDER BY mk.respawn_time ASC
      LIMIT 1
    `).get(now);
    res.json(mvp || null);
  } catch (err) {
    console.error("mvp/next:", err);
    res.status(500).json({ error: "Error al obtener próximo MVP" });
  }
});

module.exports = router;
