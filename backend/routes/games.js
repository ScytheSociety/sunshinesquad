const { Router } = require("express");
const { requireRole } = require("../middleware/auth");
const { webDB } = require("../db/web");
const { botDB } = require("../db/bot");

const router = Router();

// Migrations for new site_games columns
(function migrate() {
  const cols = [
    "mostrar_en_carrusel INTEGER DEFAULT 1",
    "mostrar_en_juegos   INTEGER DEFAULT 1",
    "bot_command_key     TEXT",
  ];
  cols.forEach(col => {
    try { webDB().prepare(`ALTER TABLE site_games ADD COLUMN ${col}`).run(); } catch {}
  });
})();

// GET /api/games/bot-games — bot games available for linking (must be BEFORE /:id)
router.get("/bot-games", (_req, res) => {
  try {
    const list = botDB().prepare(
      "SELECT id, name, command_key, COALESCE(emoji,'🎮') as emoji FROM game_info WHERE is_active=1 ORDER BY name ASC"
    ).all();
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all (public)
router.get("/", (req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=300"); // 5 min
    const games = webDB().prepare("SELECT * FROM site_games ORDER BY orden ASC, id ASC").all();

    // Enriquecer con command_key, emoji, abbreviation desde el bot
    const botGames = botDB().prepare(
      "SELECT name, command_key, abbreviation, COALESCE(emoji,'🎮') as emoji, timezone FROM game_info WHERE is_active=1"
    ).all();
    const botByName = {};
    botGames.forEach(g => { botByName[g.name.toLowerCase()] = g; });

    const enriched = games.map(g => {
      const bot = botByName[g.nombre.toLowerCase()];
      return {
        ...g,
        command_key:   bot?.command_key  || null,
        abbreviation:  bot?.abbreviation || null,
        emoji:         bot?.emoji        || "🎮",
        game_timezone: bot?.timezone     || "UTC",
        in_bot: !!bot,
      };
    });

    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET one (public)
router.get("/:id", (req, res) => {
  try {
    const game = webDB().prepare("SELECT * FROM site_games WHERE id=?").get(req.params.id);
    if (!game) return res.status(404).json({ error: "No encontrado" });
    res.json(game);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create (editor+)
router.post("/", requireRole("editor"), (req, res) => {
  try {
    const { nombre, imagen, descripcion, guild, serie, sss, servidor, url, activo, orden,
            bot_command_key } = req.body;
    if (!nombre) return res.status(400).json({ error: "nombre requerido" });
    const r = webDB().prepare(
      `INSERT INTO site_games (nombre,imagen,descripcion,guild,serie,sss,servidor,url,activo,orden,bot_command_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(nombre, imagen||"", descripcion||"", guild?1:0, serie?1:0, sss?1:0,
          servidor||"", url||"", activo!==false?1:0, orden||0, bot_command_key||null);
    res.status(201).json(webDB().prepare("SELECT * FROM site_games WHERE id=?").get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update (editor+)
router.put("/:id", requireRole("editor"), (req, res) => {
  try {
    const { nombre, imagen, descripcion, guild, serie, sss, servidor, url, activo, orden,
            bot_command_key } = req.body;
    const r = webDB().prepare(
      `UPDATE site_games SET nombre=?,imagen=?,descripcion=?,guild=?,serie=?,sss=?,servidor=?,url=?,activo=?,orden=?,
       bot_command_key=?,updated_at=datetime('now')
       WHERE id=?`
    ).run(nombre, imagen||"", descripcion||"", guild?1:0, serie?1:0, sss?1:0,
          servidor||"", url||"", activo!==false?1:0, orden||0, bot_command_key||null,
          req.params.id);
    if (!r.changes) return res.status(404).json({ error: "No encontrado" });
    res.json(webDB().prepare("SELECT * FROM site_games WHERE id=?").get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE (admin only)
router.delete("/:id", requireRole("admin"), (req, res) => {
  try {
    const r = webDB().prepare("DELETE FROM site_games WHERE id=?").run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST reorder (editor+)
router.post("/reorder", requireRole("editor"), (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "ids debe ser array" });
    const upd = webDB().prepare("UPDATE site_games SET orden=? WHERE id=?");
    webDB().transaction(ids => ids.forEach((id, i) => upd.run(i, id)))(ids);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
