const { Router } = require("express");
const { requireRole } = require("../middleware/auth");
const { webDB } = require("../db/web");

const router = Router();

// GET all (public)
router.get("/", (req, res) => {
  try {
    const games = webDB().prepare("SELECT * FROM site_games ORDER BY orden ASC, id ASC").all();
    res.json(games);
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
    const { nombre, imagen, descripcion, guild, serie, sss, servidor, url, activo, orden } = req.body;
    if (!nombre) return res.status(400).json({ error: "nombre requerido" });
    const r = webDB().prepare(
      `INSERT INTO site_games (nombre,imagen,descripcion,guild,serie,sss,servidor,url,activo,orden)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(nombre, imagen||"", descripcion||"", guild?1:0, serie?1:0, sss?1:0,
          servidor||"", url||"", activo!==false?1:0, orden||0);
    res.status(201).json(webDB().prepare("SELECT * FROM site_games WHERE id=?").get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update (editor+)
router.put("/:id", requireRole("editor"), (req, res) => {
  try {
    const { nombre, imagen, descripcion, guild, serie, sss, servidor, url, activo, orden } = req.body;
    const r = webDB().prepare(
      `UPDATE site_games SET nombre=?,imagen=?,descripcion=?,guild=?,serie=?,sss=?,servidor=?,url=?,activo=?,orden=?,updated_at=datetime('now')
       WHERE id=?`
    ).run(nombre, imagen||"", descripcion||"", guild?1:0, serie?1:0, sss?1:0,
          servidor||"", url||"", activo!==false?1:0, orden||0, req.params.id);
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
