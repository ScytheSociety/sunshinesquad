const express  = require("express");
const router   = express.Router();
const { botDB } = require("../db/bot");

// GET /api/birthdays
router.get("/", (req, res) => {
  try {
    const db = botDB();

    // Próximos 7 días como strings MM-DD para comparar con birthday_date
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d  = new Date();
      d.setDate(d.getDate() + i);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      days.push(`${mm}-${dd}`);  // formato MM-DD
    }

    const placeholders = days.map(() => "?").join(",");

    // birthday_date puede ser YYYY-MM-DD o MM-DD — usamos strftime para extraer MM-DD
    const rows = db.prepare(`
      SELECT
        discord_user_id,
        display_name    AS username,
        birthday_date
      FROM birthdays
      WHERE strftime('%m-%d', birthday_date) IN (${placeholders})
         OR substr(birthday_date, 1, 5) IN (${placeholders})
      ORDER BY strftime('%m-%d', birthday_date) ASC
    `).all(...days, ...days);

    const hoy = new Date();
    const result = rows.map(r => {
      // Extraer mes y día sea cual sea el formato
      const mmdd = r.birthday_date.length === 5
        ? r.birthday_date                            // formato MM-DD
        : r.birthday_date.substring(5);             // de YYYY-MM-DD toma MM-DD
      const [mm, dd] = mmdd.split("-").map(Number);
      const bDate = new Date(hoy.getFullYear(), mm - 1, dd);
      if (bDate < hoy) bDate.setFullYear(hoy.getFullYear() + 1);
      const diff = Math.round((bDate - hoy) / 86400000);
      return { ...r, dias_faltantes: diff };
    });

    // Deduplicar por si la doble condición trajo duplicados
    const seen = new Set();
    const unique = result.filter(r => {
      if (seen.has(r.discord_user_id)) return false;
      seen.add(r.discord_user_id);
      return true;
    });

    res.json(unique.sort((a, b) => a.dias_faltantes - b.dias_faltantes));
  } catch (err) {
    console.error("birthdays:", err);
    res.status(500).json({ error: "Error al obtener cumpleaños" });
  }
});

module.exports = router;
