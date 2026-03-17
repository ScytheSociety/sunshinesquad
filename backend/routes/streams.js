const { Router } = require("express");
const { requireRole } = require("../middleware/auth");
const { webDB } = require("../db/web");

const router = Router();

// GET all (public)
router.get("/", (req, res) => {
  try {
    const channels = webDB().prepare("SELECT * FROM site_streams ORDER BY orden ASC, id ASC").all();
    res.json({ channels });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create (editor+)
router.post("/", requireRole("editor"), (req, res) => {
  try {
    const { name, channel, activo } = req.body;
    if (!name || !channel) return res.status(400).json({ error: "name y channel requeridos" });
    const r = webDB().prepare(
      "INSERT INTO site_streams (name,channel,activo,orden) VALUES (?,?,?,(SELECT COALESCE(MAX(orden),0)+1 FROM site_streams))"
    ).run(name, channel.toLowerCase().trim(), activo !== false ? 1 : 0);
    res.status(201).json(webDB().prepare("SELECT * FROM site_streams WHERE id=?").get(r.lastInsertRowid));
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Canal ya existe" });
    res.status(500).json({ error: e.message });
  }
});

// PUT update (editor+)
router.put("/:id", requireRole("editor"), (req, res) => {
  try {
    const { name, channel, activo } = req.body;
    const r = webDB().prepare(
      "UPDATE site_streams SET name=?,channel=?,activo=? WHERE id=?"
    ).run(name, channel.toLowerCase().trim(), activo !== false ? 1 : 0, req.params.id);
    if (!r.changes) return res.status(404).json({ error: "No encontrado" });
    res.json(webDB().prepare("SELECT * FROM site_streams WHERE id=?").get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE (editor+)
router.delete("/:id", requireRole("editor"), (req, res) => {
  try {
    const r = webDB().prepare("DELETE FROM site_streams WHERE id=?").run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
