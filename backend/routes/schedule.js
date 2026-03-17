const { Router } = require("express");
const { requireRole } = require("../middleware/auth");
const { webDB } = require("../db/web");

const router = Router();

function parseAct(a) {
  if (!a) return null;
  return {
    nombre: a.nombre, juego: a.juego, descripcion: a.descripcion,
    nivel_minimo: a.nivel_minimo,
    clases:           JSON.parse(a.clases || "[]"),
    items_requeridos: JSON.parse(a.items_requeridos || "[]"),
    consumibles:      JSON.parse(a.consumibles || "[]"),
    link_info: a.link_info, link_registro: a.link_registro,
  };
}

function getOne(id) {
  const ev = webDB().prepare("SELECT * FROM site_schedule WHERE id=?").get(id);
  if (!ev) return null;
  const act = webDB().prepare("SELECT * FROM site_activities WHERE event_id=?").get(id);
  if (act) ev.actividad = parseAct(act);
  return ev;
}

// GET all (public) — formato compatible con schedule.js
router.get("/", (req, res) => {
  try {
    const eventos = webDB().prepare(
      "SELECT * FROM site_schedule WHERE activo=1 ORDER BY fecha ASC, hora ASC"
    ).all();

    const actividades = {};
    webDB().prepare("SELECT * FROM site_activities").all()
      .forEach(a => { actividades[a.event_id] = parseAct(a); });

    res.json({ zona_base: "America/Lima", eventos, actividades });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all incluyendo inactivos (admin)
router.get("/all", requireRole("editor"), (req, res) => {
  try {
    const eventos = webDB().prepare("SELECT * FROM site_schedule ORDER BY fecha ASC, hora ASC").all();
    const actividades = {};
    webDB().prepare("SELECT * FROM site_activities").all()
      .forEach(a => { actividades[a.event_id] = parseAct(a); });
    res.json({ eventos, actividades });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET one
router.get("/:id", (req, res) => {
  try {
    const ev = getOne(req.params.id);
    if (!ev) return res.status(404).json({ error: "No encontrado" });
    res.json(ev);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create (moderador+)
router.post("/", requireRole("moderador"), (req, res) => {
  try {
    const { id, fecha, hora, juego, evento, duracion, timezone, url, activo, actividad } = req.body;
    if (!id || !hora || !juego || !evento)
      return res.status(400).json({ error: "Requeridos: id, hora, juego, evento" });

    webDB().prepare(
      `INSERT INTO site_schedule (id,fecha,hora,juego,evento,duracion,timezone,url,activo)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(id, fecha||null, hora, juego, evento, duracion||1, timezone||"UTC", url||"#", activo!==false?1:0);

    if (actividad) {
      webDB().prepare(
        `INSERT OR REPLACE INTO site_activities
         (event_id,nombre,juego,descripcion,nivel_minimo,clases,items_requeridos,consumibles,link_info,link_registro)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).run(id, actividad.nombre||evento, actividad.juego||juego, actividad.descripcion||"",
            actividad.nivel_minimo||"", JSON.stringify(actividad.clases||[]),
            JSON.stringify(actividad.items_requeridos||[]), JSON.stringify(actividad.consumibles||[]),
            actividad.link_info||"#", actividad.link_registro||"#");
    }
    res.status(201).json(getOne(id));
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_PRIMARYKEY")
      return res.status(409).json({ error: "Ya existe un evento con ese ID" });
    res.status(500).json({ error: e.message });
  }
});

// PUT update (moderador+)
router.put("/:id", requireRole("moderador"), (req, res) => {
  try {
    const { fecha, hora, juego, evento, duracion, timezone, url, activo, actividad } = req.body;
    const r = webDB().prepare(
      `UPDATE site_schedule SET fecha=?,hora=?,juego=?,evento=?,duracion=?,timezone=?,url=?,activo=?,updated_at=datetime('now')
       WHERE id=?`
    ).run(fecha||null, hora, juego, evento, duracion||1, timezone||"UTC", url||"#", activo!==false?1:0, req.params.id);

    if (!r.changes) return res.status(404).json({ error: "No encontrado" });

    if (actividad) {
      webDB().prepare(
        `INSERT OR REPLACE INTO site_activities
         (event_id,nombre,juego,descripcion,nivel_minimo,clases,items_requeridos,consumibles,link_info,link_registro,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))`
      ).run(req.params.id, actividad.nombre||evento, actividad.juego||juego, actividad.descripcion||"",
            actividad.nivel_minimo||"", JSON.stringify(actividad.clases||[]),
            JSON.stringify(actividad.items_requeridos||[]), JSON.stringify(actividad.consumibles||[]),
            actividad.link_info||"#", actividad.link_registro||"#");
    }
    res.json(getOne(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE (moderador+)
router.delete("/:id", requireRole("moderador"), (req, res) => {
  try {
    const r = webDB().prepare("DELETE FROM site_schedule WHERE id=?").run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
