const { Router } = require("express");
const { requireRole } = require("../middleware/auth");
const { webDB } = require("../db/web");

const router = Router();

const DEFAULTS = {
  clan_name:           "Sunshine Squad",
  clan_description:    "Somos la división gaming de Scythe Society. Jugamos juntos, creamos contenido y construimos comunidad.",
  clan_discord:        "",
  clan_twitch:         "",
  clan_youtube:        "",
  clan_twitter:        "",
  clan_tiktok:         "",
  announcement:        "",
  announcement_type:   "info",
  announcement_active: "0",
  birthday_music_url:  "",
};

function getAll() {
  const db   = webDB();
  const rows = db.prepare("SELECT key, value FROM site_config").all();
  const cfg  = { ...DEFAULTS };
  rows.forEach(r => { cfg[r.key] = r.value; });
  return cfg;
}

// GET /api/config — público
router.get("/", (req, res) => {
  try { res.json(getAll()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/config — solo admin
router.put("/", requireRole("admin"), (req, res) => {
  try {
    const db      = webDB();
    const allowed = Object.keys(DEFAULTS);
    const upsert  = db.prepare(`
      INSERT INTO site_config (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    `);
    const save = db.transaction(() => {
      for (const key of allowed) {
        if (req.body[key] !== undefined) upsert.run(key, String(req.body[key]));
      }
    });
    save();
    res.json(getAll());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
