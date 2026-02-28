import { loadJson } from "../app.js";

const DIAS_CORTO  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const ZONA_USER   = Intl.DateTimeFormat().resolvedOptions().timeZone;
const HORA_PX     = 60;   // 1 hora = 60px
const HORAS       = 24;

let scheduleData   = [];
let activitiesData = {};
let semanaOffset   = 0;

// ── Fechas ─────────────────────────────────────────────────
function getLunes(offset = 0) {
  const hoy  = new Date();
  const dia  = hoy.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  const d    = new Date(hoy);
  d.setDate(hoy.getDate() + diff + offset * 7);
  d.setHours(0,0,0,0);
  return d;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function fmtFecha(d) {
  return d.toLocaleDateString("es", { day:"numeric", month:"short" });
}

// ── Conversión Lima → local ────────────────────────────────
function toLocal(fechaISO, horaStr) {
  const iso    = `${fechaISO}T${horaStr}:00`;
  const enLima = new Date(new Date(iso).toLocaleString("en-US", { timeZone:"America/Lima" }));
  const diff   = new Date(iso) - enLima;
  return new Date(new Date(iso).getTime() + diff);
}

// ── Estado ─────────────────────────────────────────────────
function estado(inicio, durH) {
  const ahora = new Date();
  const fin   = new Date(inicio.getTime() + (durH + 1) * 3600000);
  if (ahora < inicio) return "futuro";
  if (ahora < fin)    return "activo";
  return "pasado";
}

// ── Clase por juego ────────────────────────────────────────
function gj(juego) {
  const j = juego.toLowerCase();
  if (j.includes("ragnarok")) return "gj-ragnarok";
  if (j.includes("warcraft")) return "gj-wow";
  if (j.includes("lineage"))  return "gj-lineage";
  if (j.includes("throne"))   return "gj-throne";
  if (j.includes("brawl"))    return "gj-brawl";
  return "";
}

// ── Popup ──────────────────────────────────────────────────
function showPopup(ev, inicio, est) {
  const info = activitiesData[ev.id] || {};

  const cfg = {
    futuro: { label:"🔵 Próximo",    bg:"rgba(99,102,241,.25)", border:"#6366f1" },
    activo: { label:"🟢 En curso",   bg:"rgba(34,197,94,.25)",  border:"#22c55e" },
    pasado: { label:"⚫ Finalizado", bg:"rgba(100,116,139,.2)", border:"#64748b" }
  }[est];

  const hora  = inicio.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
  const fecha = inicio.toLocaleDateString("es", { weekday:"long", day:"numeric", month:"long" });

  const tags = arr => (arr||[]).map(x => `<span class="popup-tag">${x}</span>`).join("");

  const el = document.createElement("div");
  el.className = "popup-overlay";
  el.innerHTML = `
    <div class="popup-box">
      <button class="popup-close">✕</button>
      <div class="popup-badge" style="background:${cfg.bg};border:1px solid ${cfg.border};color:#fff;">${cfg.label}</div>
      <div class="popup-title">${info.nombre || ev.evento}</div>
      <div class="popup-sub">${ev.juego} · ${fecha} · ${hora} · ~${ev.duracion}h</div>
      ${info.descripcion ? `<div class="popup-label">Descripción</div><div class="popup-text">${info.descripcion}</div>` : ""}
      ${info.nivel_minimo ? `<div class="popup-label">Nivel mínimo</div><div class="popup-text">${info.nivel_minimo}</div>` : ""}
      ${(info.clases||[]).length ? `<div class="popup-label">Clases</div><div>${tags(info.clases)}</div>` : ""}
      ${(info.items_requeridos||[]).length ? `<div class="popup-label">Items requeridos</div><div>${tags(info.items_requeridos)}</div>` : ""}
      ${(info.consumibles||[]).length ? `<div class="popup-label">Consumibles</div><div>${tags(info.consumibles)}</div>` : ""}
      <div class="popup-actions">
        ${info.link_info && info.link_info !== "#" ? `<a href="${info.link_info}" target="_blank" class="popup-btn">📚 Ver información</a>` : ""}
        ${info.link_registro && info.link_registro !== "#" ? `<a href="${info.link_registro}" target="_blank" class="popup-btn">📋 Registro</a>` : ""}
      </div>
    </div>`;

  el.querySelector(".popup-close").onclick = () => el.remove();
  el.onclick = e => { if (e.target === el) el.remove(); };
  document.body.appendChild(el);
}

// ── Render principal ───────────────────────────────────────
function render() {
  const outer = document.getElementById("schedule-outer");
  const label = document.getElementById("schedule-week-label");
  if (!outer) return;

  const lunes = getLunes(semanaOffset);
  const dias  = Array.from({ length:7 }, (_,i) => addDays(lunes,i));
  const hoy   = new Date();

  if (label) label.textContent = `${fmtFecha(lunes)} – ${fmtFecha(addDays(lunes,6))}`;

  // ── Construir HTML ──────────────────────────────────────
  // 1) HEADER
  const headDaysHTML = dias.map(d => {
    const esHoy = isSameDay(d, hoy);
    return `
      <div class="head-day${esHoy ? " today" : ""}">
        <div class="hd-name">${DIAS_CORTO[d.getDay()]}</div>
        <div class="hd-date">${fmtFecha(d)}</div>
      </div>`;
  }).join("");

  // 2) Columna de horas
  const horasHTML = Array.from({length:HORAS}, (_,h) =>
    `<div class="hour-lbl" style="height:${HORA_PX}px;">${String(h).padStart(2,"0")}:00</div>`
  ).join("");

  // 3) Columnas de días con líneas y eventos
  const colsHTML = dias.map(d => {
    const esHoy = isSameDay(d, hoy);

    // líneas horizontales
    const lineas = Array.from({length:HORAS}, (_,h) =>
      `<div class="hr-line" style="top:${h*HORA_PX}px;"></div>`
    ).join("");

    // línea de ahora
    let nowHTML = "";
    if (esHoy && semanaOffset === 0) {
      const now = new Date();
      const px  = now.getHours() * HORA_PX + Math.floor(now.getMinutes() * HORA_PX / 60);
      nowHTML = `<div class="now-line" style="top:${px}px;"></div>`;
    }

    // eventos
    const eventsHTML = scheduleData
      .filter(ev => {
        const ini = toLocal(ev.fecha, ev.hora);
        return isSameDay(ini, d);
      })
      .map(ev => {
        const ini  = toLocal(ev.fecha, ev.hora);
        const est  = estado(ini, ev.duracion);
        const top  = ini.getHours() * HORA_PX + Math.floor(ini.getMinutes() * HORA_PX / 60);
        const h    = ev.duracion * HORA_PX;
        const hora = ini.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });

        return `<div class="sched-ev ${gj(ev.juego)} st-${est}"
                     style="top:${top}px;height:${h}px;"
                     data-evid="${ev.id}"
                     data-fecha="${ev.fecha}"
                     data-hora="${ev.hora}">
          <div class="ev-hora">${hora}</div>
          <div class="ev-juego">${ev.juego}</div>
          <div class="ev-nombre">${ev.evento}</div>
        </div>`;
      }).join("");

    return `<div class="day-col${esHoy ? " today" : ""}">${lineas}${nowHTML}${eventsHTML}</div>`;
  }).join("");

  // ── Insertar en DOM ─────────────────────────────────────
  outer.innerHTML = `
    <div class="schedule-head">
      <div class="head-gutter"></div>
      <div class="head-days">${headDaysHTML}</div>
    </div>
    <div class="schedule-body" id="sched-body">
      <div class="hours-col">${horasHTML}</div>
      <div class="days-grid">${colsHTML}</div>
    </div>`;

  // Scroll a las 8am
  setTimeout(() => {
    const body = document.getElementById("sched-body");
    if (body) body.scrollTop = 8 * HORA_PX;
  }, 30);

  // Eventos click en tarjetas
  outer.querySelectorAll(".sched-ev").forEach(el => {
    el.addEventListener("click", () => {
      const evId   = el.dataset.evid;
      const evData = scheduleData.find(e => e.id === evId);
      if (!evData) return;
      const ini = toLocal(evData.fecha, evData.hora);
      showPopup(evData, ini, estado(ini, evData.duracion));
    });
  });
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [sched, acts] = await Promise.all([
      loadJson("data/schedule.json"),
      loadJson("data/activities.json")
    ]);
    scheduleData   = sched.eventos;
    activitiesData = acts;

    const tzEl = document.getElementById("schedule-tz");
    if (tzEl) tzEl.innerHTML = `Horario en tu zona horaria: <span>${ZONA_USER}</span>`;

    render();

    document.getElementById("schedule-prev")?.addEventListener("click", () => { semanaOffset--; render(); });
    document.getElementById("schedule-next")?.addEventListener("click", () => { semanaOffset++; render(); });

  } catch(e) { console.error("schedule:", e); }
});