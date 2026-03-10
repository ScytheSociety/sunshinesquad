const express  = require("express");
const router   = express.Router();
const { botDB } = require("../db/bot");

// GET /api/birthdays  → cumpleaños en los próximos 7 días
router.get("/", (req, res) => {
  try {
    const db = botDB();

    // Construir array de los próximos 7 días en formato DD/MM
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      days.push(`${dd}/${mm}`);
    }

    const placeholders = days.map(() => "?").join(",");
    const rows = db.prepare(`
      SELECT
        discord_id,
        username,
        birthday,
        avatar_url
      FROM birthdays
      WHERE birthday IN (${placeholders})
      ORDER BY birthday ASC
    `).all(...days);

    // Añadir info de cuántos días faltan
    const hoy = new Date();
    const result = rows.map(r => {
      const [dd, mm] = r.birthday.split("/").map(Number);
      const bDate = new Date(hoy.getFullYear(), mm - 1, dd);
      if (bDate < hoy) bDate.setFullYear(hoy.getFullYear() + 1);
      const diff = Math.round((bDate - hoy) / 86400000);
      return { ...r, dias_faltantes: diff };
    });

    res.json(result);
  } catch (err) {
    console.error("birthdays:", err);
    res.status(500).json({ error: "Error al obtener cumpleaños" });
  }
});

module.exports = router;
