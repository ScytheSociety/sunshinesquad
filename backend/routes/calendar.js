const { Router } = require("express");
const { webDB } = require("../db/web");
const router = Router();

// Convert local datetime (fecha YYYY-MM-DD, hora HH:MM, tz) to UTC Date
function toUTCDate(fecha, hora, tz = "UTC") {
  if (!fecha) return null;
  if (tz === "UTC") return new Date(`${fecha}T${hora}:00Z`);
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year:"numeric", month:"2-digit", day:"2-digit",
      hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false,
    });
    const localDesired = new Date(`${fecha}T${hora}:00Z`);
    const parts = fmt.formatToParts(localDesired).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
    const localOfGuess = new Date(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`
    );
    return new Date(localDesired.getTime() - (localOfGuess.getTime() - localDesired.getTime()));
  } catch {
    return new Date(`${fecha}T${hora}:00Z`);
  }
}

function toICalDate(d) {
  if (!d || isNaN(d)) return null;
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcal(str) {
  return (str || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// GET /api/calendar/ical
router.get("/ical", (req, res) => {
  try {
    const eventos = webDB().prepare(
      "SELECT * FROM site_schedule WHERE activo=1 ORDER BY fecha ASC, hora ASC"
    ).all();

    const activities = {};
    webDB().prepare("SELECT * FROM site_activities").all()
      .forEach(a => { activities[a.event_id] = a; });

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Sunshine Squad//Schedule//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Sunshine Squad",
      "X-WR-CALDESC:Eventos de la comunidad Sunshine Squad",
      "X-WR-TIMEZONE:UTC",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ];

    for (const ev of eventos) {
      if (!ev.fecha || !ev.hora) continue;
      const tz    = ev.timezone || "UTC";
      const start = toUTCDate(ev.fecha, ev.hora, tz);
      if (!start) continue;

      const durMs   = (ev.duracion || 1) * 3600000;
      const end     = new Date(start.getTime() + durMs);
      const dtStart = toICalDate(start);
      const dtEnd   = toICalDate(end);
      if (!dtStart || !dtEnd) continue;

      const act   = activities[ev.id];
      const desc  = act?.descripcion || "";
      const level = act?.nivel_minimo ? `Nivel: ${act.nivel_minimo}` : "";
      const fullDesc = [desc, level].filter(Boolean).join(" | ");

      lines.push("BEGIN:VEVENT");
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      lines.push(`SUMMARY:${escapeIcal(ev.evento)} (${escapeIcal(ev.juego)})`);
      if (fullDesc) lines.push(`DESCRIPTION:${escapeIcal(fullDesc)}`);
      lines.push(`CATEGORIES:${escapeIcal(ev.juego)}`);
      lines.push(`UID:${ev.id}@sunshinesquad.es`);
      lines.push(`DTSTAMP:${toICalDate(new Date())}`);
      lines.push(`STATUS:CONFIRMED`);
      if (ev.url && ev.url !== "#") lines.push(`URL:${escapeIcal(ev.url)}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    const body = lines.join("\r\n") + "\r\n";

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=sunshine-squad.ics");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.send(body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
