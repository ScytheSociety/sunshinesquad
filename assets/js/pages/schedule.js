import { loadJson } from "../app.js";

const DIAS_CORTO = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MESES      = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const ZONA_USER  = Intl.DateTimeFormat().resolvedOptions().timeZone;
const HORA_PX    = 38;   // 1 hora = 38px → 24h = 912px sin scroll
const HORAS      = 24;
const API        = "https://sunshinesquad.es/api";

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
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}
function fmtCorto(d) { return d.toLocaleDateString("es", { day:"numeric", month:"short" }); }

// ── Conversión timezone → local (corregido, compatible Safari) ─────
function toLocal(fechaISO, horaStr, timezone = "America/Lima") {
  const isoStr = `${fechaISO}T${horaStr}:00`;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
  });
  const utcRef = new Date(isoStr + "Z");
  const parts  = fmt.formatToParts(utcRef).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  const tzDate = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
  return new Date(utcRef.getTime() + (utcRef - tzDate));
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

// ── Fragmentos (corta eventos que cruzan medianoche) ───────
function getFragmentos(ev) {
  const ini   = toLocal(ev.fecha, ev.hora, ev.timezone || "America/Lima");
  const finMs = ini.getTime() + ev.duracion * 3600000;
  const frags = [];
  let diaActual = new Date(ini);
  diaActual.setHours(0,0,0,0);

  while (diaActual.getTime() < finMs) {
    const inicioFrag = Math.max(ini.getTime(), diaActual.getTime());
    const finDia     = diaActual.getTime() + 24 * 3600000;
    const finFrag    = Math.min(finMs, finDia);
    const topMin     = (inicioFrag - diaActual.getTime()) / 60000;
    const durMin     = (finFrag - inicioFrag) / 60000;

    frags.push({
      dia:   new Date(diaActual),
      topPx: topMin * (HORA_PX / 60),
      altPx: Math.max(durMin * (HORA_PX / 60), 20),
      hora:  new Date(inicioFrag),
      esCont: inicioFrag > ini.getTime(),
      ev
    });
    diaActual = new Date(finDia);
  }
  return frags;
}

// ── Popup ──────────────────────────────────────────────────
function showPopup(ev, inicio, est) {
  const info = activitiesData[ev.id] || {};
  const cfg  = {
    futuro: { label:"🔵 Próximo",    bg:"rgba(99,102,241,.25)", border:"#6366f1" },
    activo: { label:"🟢 En curso",   bg:"rgba(34,197,94,.25)",  border:"#22c55e" },
    pasado: { label:"⚫ Finalizado", bg:"rgba(100,116,139,.2)", border:"#64748b" }
  }[est];

  const hora  = inicio.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
  const fecha = inicio.toLocaleDateString("es", { weekday:"long", day:"numeric", month:"long" });
  const tags  = arr => (arr||[]).map(x => `<span class="popup-tag">${x}</span>`).join("");

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

// ── Render ─────────────────────────────────────────────────
function render() {
  const outer = document.getElementById("schedule-outer");
  if (!outer) return;

  const lunes = getLunes(semanaOffset);
  const dias  = Array.from({ length:7 }, (_,i) => addDays(lunes, i));
  const hoy   = new Date();

  // Header elegante
  const dom        = addDays(lunes, 6);
  const mesInicio  = lunes.getMonth();
  const mesFin     = dom.getMonth();
  const anioInicio = lunes.getFullYear();
  const anioFin    = dom.getFullYear();
  const mesLabel   = mesInicio === mesFin ? MESES[mesInicio] : `${MESES[mesInicio]} · ${MESES[mesFin]}`;
  const anioLabel  = anioInicio === anioFin ? `${anioInicio}` : `${anioInicio} · ${anioFin}`;

  const labelEl = document.getElementById("schedule-week-label");
  if (labelEl) labelEl.innerHTML = `
    <div class="swl-year">${anioLabel}</div>
    <div class="swl-month">${mesLabel}</div>
    <div class="swl-range">Semana del ${fmtCorto(lunes)} al ${fmtCorto(dom)}</div>`;

  // Header días
  const headDaysHTML = dias.map(d => {
    const esHoy = isSameDay(d, hoy);
    return `<div class="head-day${esHoy ? " today" : ""}">
      <div class="hd-name">${DIAS_CORTO[d.getDay()]}</div>
      <div class="hd-date">${fmtCorto(d)}</div>
    </div>`;
  }).join("");

  // Columna de horas
  const horasHTML = Array.from({length:HORAS}, (_,h) =>
    `<div class="hour-lbl" style="height:${HORA_PX}px;">${String(h).padStart(2,"0")}:00</div>`
  ).join("");

  // Fragmentos
  const todosFrag = scheduleData.flatMap(ev => getFragmentos(ev));

  // Columnas de días
  const colsHTML = dias.map(d => {
    const esHoy = isSameDay(d, hoy);

    const lineasH = Array.from({length:HORAS}, (_,h) =>
      `<div class="hr-line" style="top:${h * HORA_PX}px;"></div>`
    ).join("");

    let nowHTML = "";
    if (esHoy && semanaOffset === 0) {
      const now = new Date();
      const px  = now.getHours() * HORA_PX + Math.floor(now.getMinutes() * (HORA_PX / 60));
      nowHTML = `<div class="now-line" style="top:${px}px;"></div>`;
    }

    const eventsHTML = todosFrag
      .filter(f => isSameDay(f.dia, d))
      .map(f => {
        const ev   = f.ev;
        const est  = estado(toLocal(ev.fecha, ev.hora, ev.timezone || "America/Lima"), ev.duracion);
        const hora = f.hora.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
        return `<div class="sched-ev ${gj(ev.juego)} st-${est}"
                     style="top:${f.topPx}px;height:${f.altPx}px;"
                     data-evid="${ev.id}">
          ${!f.esCont ? `<div class="ev-hora">${hora}</div>` : `<div class="ev-cont">↑ continúa</div>`}
          <div class="ev-juego">${ev.juego}</div>
          ${f.altPx > 38 ? `<div class="ev-nombre">${ev.evento}</div>` : ""}
        </div>`;
      }).join("");

    return `<div class="day-col${esHoy ? " today" : ""}">${lineasH}${nowHTML}${eventsHTML}</div>`;
  }).join("");

  // Líneas verticales como divs absolutos — nunca se cortan
  const lineasV = Array.from({length:7}, (_,i) =>
    `<div class="vr-line" style="left:${((i+1)/7*100).toFixed(4)}%;"></div>`
  ).join("");

  // DOM
  outer.innerHTML = `
    <div class="schedule-head">
      <div class="head-gutter"></div>
      <div class="head-days">${headDaysHTML}</div>
    </div>
    <div class="schedule-body">
      <div class="hours-col">${horasHTML}</div>
      <div class="days-grid">${lineasV}${colsHTML}</div>
    </div>`;

  // Clicks
  outer.querySelectorAll(".sched-ev").forEach(el => {
    el.addEventListener("click", () => {
      const evData = scheduleData.find(e => e.id === el.dataset.evid);
      if (!evData) return;
      const ini = toLocal(evData.fecha, evData.hora);
      showPopup(evData, ini, estado(ini, evData.duracion));
    });
  });
}

// ── Carga eventos: API primero, JSON como fallback ─────────
async function fetchEventos() {
  try {
    const res  = await fetch(`${API}/events?semana=${semanaOffset}`);
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.eventos || [];
  } catch {
    // fallback a JSON estático
    const sched = await loadJson("data/schedule.json");
    return sched.eventos || [];
  }
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const [eventos, acts] = await Promise.all([
      fetchEventos(),
      loadJson("data/activities.json")
    ]);
    scheduleData   = eventos;
    activitiesData = acts;

    const tzEl = document.getElementById("schedule-tz");
    if (tzEl) tzEl.innerHTML = `Horario en tu zona horaria: <span>${ZONA_USER}</span>`;

    render();

    document.getElementById("schedule-prev")?.addEventListener("click", async () => {
      semanaOffset--;
      scheduleData = await fetchEventos();
      render();
    });
    document.getElementById("schedule-next")?.addEventListener("click", async () => {
      semanaOffset++;
      scheduleData = await fetchEventos();
      render();
    });

  } catch(e) { console.error("schedule:", e); }
});