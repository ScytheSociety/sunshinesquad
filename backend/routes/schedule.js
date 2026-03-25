const { Router } = require("express");
const { requireRole, requireAuth } = require("../middleware/auth");
const { webDB } = require("../db/web");
const { botDB } = require("../db/bot");
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
    res.set("Cache-Control", "public, max-age=60"); // 1 min
    const rawEventos = webDB().prepare(
      "SELECT * FROM site_schedule WHERE activo=1 ORDER BY fecha ASC, hora ASC"
    ).all();

    // Auto-avanzar fechas pasadas (recurrencia semanal)
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const siteEventos = rawEventos.map(ev => {
      if (!ev.fecha) return ev;
      let d = new Date(ev.fecha + 'T00:00:00');
      let iterations = 0;
      while (d < now && iterations < 52) {
        d.setDate(d.getDate() + 7);
        iterations++;
      }
      return { ...ev, fecha: d.toISOString().split('T')[0], source: "site" };
    });

    const actividades = {};
    webDB().prepare("SELECT * FROM site_activities").all()
      .forEach(a => { actividades[a.event_id] = parseAct(a); });

    // Eventos del bot (no cancelados, desde hace 30 días a futuro)
    let botEventos = [];
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      const rawBot = botDB().prepare(`
        SELECT e.id, e.name, e.description, e.event_datetime, e.duration_minutes,
               e.status, e.creator_id, e.published_by, e.difficulty, e.participant_count,
               gi.name as game_name, gi.command_key,
               COALESCE(gi.timezone, 'UTC') as timezone,
               COALESCE(a.points, 0)         as activity_points,
               COALESCE(a.name, '')           as activity_name,
               COALESCE(a.image_url, '')      as activity_image,
               COALESCE(pub.display_name, '') as published_by_username,
               COALESCE(pub.avatar_url, '')   as published_by_avatar
        FROM events e
        JOIN game_info gi ON gi.id = e.game_id
        LEFT JOIN activities a ON a.id = e.activity_id
        LEFT JOIN users pub ON CAST(pub.discord_user_id AS TEXT) = CAST(e.published_by AS TEXT)
        WHERE e.status NOT IN ('cancelled','canceled')
          AND date(e.event_datetime) >= ?
        ORDER BY e.event_datetime ASC
      `).all(cutoffStr);

      botEventos = rawBot.map(e => {
        const dt = e.event_datetime.replace(' ', 'T');
        const fecha = dt.slice(0, 10);
        const hora  = dt.slice(11, 16);
        return {
          id:              `bot-${e.id}`,
          bot_id:          e.id,
          fecha,
          hora,
          juego:           e.game_name,
          evento:          e.name,
          duracion:        Math.round((e.duration_minutes || 60) / 60 * 10) / 10,
          timezone:        e.timezone,
          activo:          1,
          source:          "bot",
          status:          e.status,
          description:     e.description || "",
          difficulty:      e.difficulty || "",
          command_key:     e.command_key,
          creator_id:      e.creator_id || "",
          published_by:    e.published_by || e.creator_id || "",
          participant_count: e.participant_count || 0,
          activity_points:       e.activity_points || 0,
          activity_name:         e.activity_name || "",
          activity_image:        e.activity_image || "",
          published_by_username: e.published_by_username || "",
          published_by_avatar:   e.published_by_avatar || "",
        };
      });
    } catch (botErr) {
      console.error("schedule bot events:", botErr);
    }

    const eventos = [...siteEventos, ...botEventos].sort((a, b) => {
      const da = new Date(`${a.fecha}T${a.hora || '00:00'}:00`);
      const db2 = new Date(`${b.fecha}T${b.hora || '00:00'}:00`);
      return da - db2;
    });

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

// ── Bot Event Detail ──────────────────────────────────────────────────
// GET /api/schedule/bot/:id — detalles completos del evento del bot
router.get("/bot/:id", (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const ev = botDB().prepare(`
      SELECT e.*, gi.name as game_name, COALESCE(gi.timezone,'UTC') as timezone,
             COALESCE(a.points,0)    as activity_points,
             COALESCE(a.name,'')     as activity_name,
             COALESCE(a.image_url,'') as activity_image,
             COALESCE(a.emoji,'')    as activity_emoji
      FROM events e
      JOIN game_info gi ON gi.id = e.game_id
      LEFT JOIN activities a ON a.id = e.activity_id
      WHERE e.id=?
    `).get(eventId);
    if (!ev) return res.status(404).json({ error: "Evento no encontrado" });
    try { ev.slot_config = JSON.parse(ev.slot_config || "[]"); } catch { ev.slot_config = []; }
    res.json(ev);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── RSVP Bot Events ──────────────────────────────────────────────────
// GET /api/schedule/bot/:id/rsvp — participantes (bot.db + web.db) + personajes del usuario
router.get("/bot/:id/rsvp", (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const eventRow = botDB().prepare(
      "SELECT id, game_id, status, max_participants FROM events WHERE id=?"
    ).get(eventId);
    if (!eventRow) return res.status(404).json({ error: "Evento no encontrado" });

    // Inscripciones desde el bot (Discord)
    const botRows = botDB().prepare(`
      SELECT er.discord_user_id, er.slot_type, er.is_wildcard, er.bench_voluntary,
             er.character_level,
             u.display_name AS username, u.avatar_url,
             c.character_name,
             COALESCE(cl.emoji,'⚔️')        AS class_emoji,
             COALESCE(r.emoji,'')           AS role_emoji,
             COALESCE(r.name,'')            AS role_name,
             COALESCE(r.display_order, 99)  AS role_display_order,
             'bot' as source
      FROM event_registrations er
      JOIN users u ON er.user_id = u.id
      LEFT JOIN characters c ON er.character_id = c.id
      LEFT JOIN classes cl   ON cl.id = c.class_id
      LEFT JOIN roles r      ON r.id  = er.selected_role_id
      WHERE er.event_id = ? AND er.status = 'registered'
      ORDER BY er.is_wildcard ASC, er.bench_voluntary ASC, er.registered_at ASC
    `).all(eventId);

    // Inscripciones desde la web (web.db)
    const webRows = webDB().prepare(`
      SELECT user_id as discord_user_id,
             COALESCE(slot_type,'free') as slot_type,
             COALESCE(is_wildcard,0)    as is_wildcard,
             COALESCE(bench_voluntary,0) as bench_voluntary,
             COALESCE(character_level,1) as character_level,
             username, '' as avatar_url, character_name,
             '⚔️' as class_emoji, '' as role_emoji,
             COALESCE(role_name,'') as role_name,
             'web' as source
      FROM bot_event_rsvp WHERE event_id=?
      ORDER BY is_wildcard ASC, bench_voluntary ASC, created_at ASC
    `).all(eventId);

    // Fusionar: bot tiene prioridad; eliminar duplicados por discord_user_id
    const botIds = new Set(botRows.map(r => r.discord_user_id));
    const rows   = [...botRows, ...webRows.filter(r => !botIds.has(r.discord_user_id))];

    let myRsvp = null;
    let characters = [];
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const jwt = require("jsonwebtoken");
        const token = authHeader.replace("Bearer ", "");
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Buscar en bot primero, luego en web
        myRsvp = botRows.find(r => r.discord_user_id === decoded.id) || null;
        if (!myRsvp) {
          const wr = webDB().prepare("SELECT * FROM bot_event_rsvp WHERE event_id=? AND user_id=?")
            .get(eventId, decoded.id);
          if (wr) myRsvp = {
            discord_user_id: wr.user_id,
            slot_type:       wr.slot_type || 'free',
            is_wildcard:     wr.is_wildcard || 0,
            bench_voluntary: wr.bench_voluntary || 0,
            character_level: wr.character_level || 1,
            username:        wr.username || "",
            avatar_url:      null,
            character_name:  wr.character_name || null,
            class_emoji:     '⚔️',
            role_emoji:      '',
            role_name:       wr.role_name || '',
          };
        }
        characters = botDB().prepare(`
          SELECT c.id, c.character_name, c.level, c.is_main,
                 COALESCE(cl.name,'')    AS class_name,
                 COALESCE(cl.emoji,'⚔️') AS class_emoji,
                 COALESCE(r.name,'')     AS role_name,
                 COALESCE(r.emoji,'')    AS role_emoji
          FROM characters c
          LEFT JOIN classes cl ON cl.id = c.class_id
          LEFT JOIN roles r   ON r.id  = c.role_id
          WHERE c.discord_user_id = ? AND c.game_id = ? AND c.is_active = 1
          ORDER BY c.is_main DESC, c.points DESC
        `).all(decoded.id, eventRow.game_id);
      } catch {}
    }

    res.json({ count: rows.length, max: eventRow.max_participants || null, users: rows, myRsvp, characters });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/schedule/bot/:id/rsvp — inscribirse / editar (escribe en web.db)
router.post("/bot/:id/rsvp", requireAuth, (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const ev = botDB().prepare("SELECT id, game_id, status FROM events WHERE id=?").get(eventId);
    if (!ev) return res.status(404).json({ error: "Evento no encontrado" });

    const { character_id, type } = req.body;
    const isWildcard     = type === "wildcard" ? 1 : 0;
    const slotType       = type === "bench"    ? "bench" : "free";
    const benchVoluntary = type === "bench"    ? 1 : 0;

    // Leer datos del personaje desde bot.db (solo lectura)
    let charLevel = 1, charName = null, roleName = null;
    if (character_id) {
      const ch = botDB().prepare(`
        SELECT c.level, c.character_name, COALESCE(r.name,'') as role_name
        FROM characters c
        LEFT JOIN roles r ON r.id = c.role_id
        WHERE c.id=?
      `).get(parseInt(character_id));
      if (ch) { charLevel = ch.level; charName = ch.character_name; roleName = ch.role_name; }
    }

    // Escribir inscripción en web.db
    webDB().prepare(`
      INSERT INTO bot_event_rsvp
        (event_id, user_id, username, character_name, character_id, role_name,
         character_level, slot_type, is_wildcard, bench_voluntary)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(event_id, user_id) DO UPDATE SET
        character_name  = excluded.character_name,
        character_id    = excluded.character_id,
        role_name       = excluded.role_name,
        character_level = excluded.character_level,
        slot_type       = excluded.slot_type,
        is_wildcard     = excluded.is_wildcard,
        bench_voluntary = excluded.bench_voluntary
    `).run(eventId, req.user.id, req.user.username || "",
           charName, character_id ? parseInt(character_id) : null,
           roleName, charLevel, slotType, isWildcard, benchVoluntary);

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/schedule/bot/:id/rsvp — cancelar inscripción (web.db)
router.delete("/bot/:id/rsvp", requireAuth, (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    webDB().prepare(
      "DELETE FROM bot_event_rsvp WHERE event_id=? AND user_id=?"
    ).run(eventId, req.user.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
