const express  = require("express");
const router   = express.Router();
const { botDB } = require("../db/bot");

// GET /api/events?semana=0
// semana=0 → semana actual, semana=-1 → anterior, semana=1 → próxima
router.get("/", (req, res) => {
  try {
    const db = botDB();

    // Calcular rango de fechas para la semana solicitada
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
        e.event_name   AS evento,
        e.game         AS juego,
        e.date         AS fecha,
        e.time         AS hora,
        e.duration     AS duracion,
        e.status,
        e.description,
        COALESCE(g.timezone, 'America/Lima') AS timezone
      FROM events e
      LEFT JOIN game_info g ON lower(e.game) = lower(g.game_name)
      WHERE e.date BETWEEN ? AND ?
      ORDER BY e.date ASC, e.time ASC
    `).all(fmt(lunes), fmt(domingo));

    res.json({ semanaOffset: offset, eventos });
  } catch (err) {
    console.error("events:", err);
    res.status(500).json({ error: "Error al obtener eventos" });
  }
});

// GET /api/events/all  → todos los eventos (para calendario completo)
router.get("/all", (req, res) => {
  try {
    const db = botDB();
    const eventos = db.prepare(`
      SELECT
        e.id,
        e.event_name   AS evento,
        e.game         AS juego,
        e.date         AS fecha,
        e.time         AS hora,
        e.duration     AS duracion,
        e.status,
        COALESCE(g.timezone, 'America/Lima') AS timezone
      FROM events e
      LEFT JOIN game_info g ON lower(e.game) = lower(g.game_name)
      ORDER BY e.date DESC
      LIMIT 500
    `).all();
    res.json(eventos);
  } catch (err) {
    console.error("events/all:", err);
    res.status(500).json({ error: "Error al obtener eventos" });
  }
});

module.exports = router;
