const express  = require("express");
const router   = express.Router();
const { botDB } = require("../db/bot");

// GET /api/mvp  → lista de MVPs activos/anunciados con info del boss
router.get("/", (req, res) => {
  try {
    const db = botDB();

    const mvps = db.prepare(`
      SELECT
        mk.id,
        mk.boss_name,
        mk.killed_at,
        mk.announced_at,
        mk.respawn_at,
        mk.status,
        mk.channel_id,
        mb.min_respawn,
        mb.max_respawn,
        mb.map,
        mb.image_url
      FROM mvp_kills mk
      LEFT JOIN mvp_bosses mb ON lower(mk.boss_name) = lower(mb.name)
      WHERE mk.status IN ('active', 'announced')
      ORDER BY mk.respawn_at ASC
      LIMIT 20
    `).all();

    res.json(mvps);
  } catch (err) {
    console.error("mvp:", err);
    res.status(500).json({ error: "Error al obtener MVPs" });
  }
});

// GET /api/mvp/next  → próximo MVP a spawnear
router.get("/next", (req, res) => {
  try {
    const db = botDB();
    const now = new Date().toISOString();

    const mvp = db.prepare(`
      SELECT
        mk.boss_name,
        mk.respawn_at,
        mk.status,
        mb.map,
        mb.image_url,
        mb.min_respawn,
        mb.max_respawn
      FROM mvp_kills mk
      LEFT JOIN mvp_bosses mb ON lower(mk.boss_name) = lower(mb.name)
      WHERE mk.status IN ('active', 'announced') AND mk.respawn_at > ?
      ORDER BY mk.respawn_at ASC
      LIMIT 1
    `).get(now);

    res.json(mvp || null);
  } catch (err) {
    console.error("mvp/next:", err);
    res.status(500).json({ error: "Error al obtener próximo MVP" });
  }
});

module.exports = router;
