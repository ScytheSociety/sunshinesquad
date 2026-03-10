const express  = require("express");
const router   = express.Router();
const { botDB } = require("../db/bot");

// GET /api/events?semana=0
router.get("/", (req, res) => {
  try {
    const db = botDB();
    const offset  = parseInt(req.query.semana) || 0;
    const hoy     = new Date();
    const diaSem  = hoy.getDay();
    const diffLun = diaSem === 0 ? -6 : 1 - diaSem;
    const lunes   = new Date(hoy);
    lunes.setDate(hoy.getDate() + diffLun + offset * 7);
    lunes.setHours(0, 0, 0, 0);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    domingo.setHours(23, 59, 59, 999);
    const fmt = d => d.toISOString().split("T")[0];

    const eventos = db.prepare(`
      SELECT
        e.id,
        e.name                                     AS evento,
        g.name                                     AS juego,
        date(e.event_datetime)                     AS fecha,
        time(e.event_datetime)                     AS hora,
        ROUND(e.duration_minutes / 60.0, 1)        AS duracion,
        e.status,
        e.description,
        COALESCE(g.timezone, 'UTC')                AS timezone
      FROM events e
      LEFT JOIN game_info g ON e.game_id = g.id
      WHERE date(e.event_datetime) BETWEEN ? AND ?
        AND e.status != 'cancelled'
      ORDER BY e.event_datetime ASC
    `).all(fmt(lunes), fmt(domingo));

    res.json({ semanaOffset: offset, eventos });
  } catch (err) {
    console.error("events:", err);
    res.status(500).json({ error: "Error al obtener eventos" });
  }
});

// GET /api/events/all
router.get("/all", (req, res) => {
  try {
    const db = botDB();
    const eventos = db.prepare(`
      SELECT
        e.id,
        e.name                              AS evento,
        g.name                              AS juego,
        date(e.event_datetime)              AS fecha,
        time(e.event_datetime)              AS hora,
        ROUND(e.duration_minutes / 60.0, 1) AS duracion,
        e.status,
        COALESCE(g.timezone, 'UTC')         AS timezone
      FROM events e
      LEFT JOIN game_info g ON e.game_id = g.id
      WHERE e.status != 'cancelled'
      ORDER BY e.event_datetime DESC
      LIMIT 500
    `).all();
    res.json(eventos);
  } catch (err) {
    console.error("events/all:", err);
    res.status(500).json({ error: "Error al obtener eventos" });
  }
});

module.exports = router;
