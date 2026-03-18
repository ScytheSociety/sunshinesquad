const { Router } = require("express");
const { requireRole, requireAuth } = require("../middleware/auth");
const { webDB } = require("../db/web");
const { sendPush } = require("../utils/pushHelper");

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
    const created = getOne(id);
    if (activo !== false) {
      sendPush({
        type: "event", title: `📅 Nuevo evento: ${evento}`,
        body: `${juego}${fecha ? ` · ${fecha}` : ""} ${hora || ""}`.trim(),
        url:  `https://sunshinesquad.es/pages/horario/schedule.html`,
        sentBy: req.user?.id || "system",
      }).catch(() => {});
    }
    res.status(201).json(created);
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

// ── RSVP ──────────────────────────────────────────────────────────────
// GET /api/schedule/:id/rsvp — conteo público
router.get("/:id/rsvp", (req, res) => {
  try {
    const rows = webDB().prepare(
      "SELECT user_id, username FROM site_event_rsvp WHERE event_id=? ORDER BY created_at ASC"
    ).all(req.params.id);
    res.json({ count: rows.length, users: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/schedule/:id/rsvp — confirmar asistencia
router.post("/:id/rsvp", requireAuth, (req, res) => {
  try {
    const ev = webDB().prepare("SELECT id FROM site_schedule WHERE id=?").get(req.params.id);
    if (!ev) return res.status(404).json({ error: "Evento no encontrado" });

    webDB().prepare(
      `INSERT OR REPLACE INTO site_event_rsvp (event_id, user_id, username, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).run(req.params.id, req.user.id, req.user.username);

    const rows = webDB().prepare(
      "SELECT user_id, username FROM site_event_rsvp WHERE event_id=?"
    ).all(req.params.id);
    res.json({ ok: true, count: rows.length, users: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/schedule/:id/rsvp — cancelar asistencia
router.delete("/:id/rsvp", requireAuth, (req, res) => {
  try {
    webDB().prepare(
      "DELETE FROM site_event_rsvp WHERE event_id=? AND user_id=?"
    ).run(req.params.id, req.user.id);

    const rows = webDB().prepare(
      "SELECT user_id, username FROM site_event_rsvp WHERE event_id=?"
    ).all(req.params.id);
    res.json({ ok: true, count: rows.length, users: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
