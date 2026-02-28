import { loadJson } from "../app.js";

const DIAS_CORTO = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const ZONA_USUARIO = Intl.DateTimeFormat().resolvedOptions().timeZone;

let scheduleData   = [];
let activitiesData = {};
let semanaOffset   = 0; // 0 = semana actual, 1 = próxima, -1 = anterior

// ── Utilidades de fecha ────────────────────────────────────
function getLunes(offset = 0) {
  const hoy   = new Date();
  const dia   = hoy.getDay(); // 0=Dom
  const diff  = (dia === 0) ? -6 : 1 - dia;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff + offset * 7);
  lunes.setHours(0,0,0,0);
  return lunes;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function formatFechaLabel(date) {
  return date.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function formatSemanaLabel(lunes) {
  const dom = addDays(lunes, 6);
  return `${formatFechaLabel(lunes)} – ${formatFechaLabel(dom)}`;
}

// ── Convierte fecha+hora Lima → Date local ─────────────────
function toLocalDate(fechaISO, horaStr, zonaBase) {
  const isoStr  = `${fechaISO}T${horaStr}:00`;
  const enBase  = new Date(new Date(isoStr).toLocaleString("en-US", { timeZone: zonaBase }));
  const diffMs  = new Date(isoStr) - enBase;
  return new Date(new Date(isoStr).getTime() + diffMs);
}

// ── Estado del evento ──────────────────────────────────────
function getEstado(inicio, duracionH) {
  const ahora = new Date();
  const fin   = new Date(inicio.getTime() + duracionH * 3600000);
  const pasadoLimite = new Date(fin.getTime() + 3600000); // 1h extra
  if (ahora < inicio)           return "futuro";
  if (ahora < pasadoLimite)     return "activo";
  return "pasado";
}

// ── Color por juego ────────────────────────────────────────
function juegoClass(juego) {
  const j = juego.toLowerCase();
  if (j.includes("ragnarok")) return "ev-ragnarok";
  if (j.includes("warcraft")) return "ev-wow";
  if (j.includes("lineage"))  return "ev-lineage";
  if (j.includes("throne"))   return "ev-throne";
  if (j.includes("brawl"))    return "ev-brawl";
  return "";
}

// ── Popup ──────────────────────────────────────────────────
function showPopup(ev, inicio, estado) {
  const info = activitiesData[ev.id] || {};

  const estadoLabel = { futuro: "🔵 Próximo", activo: "🟢 En curso", pasado: "⚫ Finalizado" };
  const estadoColor = { futuro: "rgba(99,102,241,.25)", activo: "rgba(34,197,94,.25)", pasado: "rgba(100,116,139,.2)" };
  const estadoBorder= { futuro: "#6366f1", activo: "#22c55e", pasado: "#64748b" };

  const horaStr = inicio.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12: true });
  const fechaStr= inicio.toLocaleDateString("es", { weekday:"long", day:"numeric", month:"long" });

  const clases     = (info.clases     || []).map(c => `<span class="popup-tag">${c}</span>`).join("");
  const items      = (info.items_requeridos || []).map(i => `<span class="popup-tag">${i}</span>`).join("");
  const consumibles= (info.consumibles|| []).map(c => `<span class="popup-tag">${c}</span>`).join("");

  const overlay = document.createElement("div");
  overlay.className = "schedule-popup-overlay";
  overlay.innerHTML = `
    <div class="schedule-popup">
      <button class="popup-close">✕</button>

      <div class="popup-badge" style="background:${estadoColor[estado]};border:1px solid ${estadoBorder[estado]};color:#fff;">
        ${estadoLabel[estado]}
      </div>

      <div class="popup-title">${info.nombre || ev.evento}</div>
      <div class="popup-juego">${ev.juego} · ${fechaStr} · ${horaStr} · ~${ev.duracion}h</div>

      ${info.descripcion ? `
        <div class="popup-section-title">Descripción</div>
        <div class="popup-value">${info.descripcion}</div>
      ` : ""}

      ${info.nivel_minimo ? `
        <div class="popup-section-title">Nivel mínimo requerido</div>
        <div class="popup-value">${info.nivel_minimo}</div>
      ` : ""}

      ${clases ? `
        <div class="popup-section-title">Clases</div>
        <div>${clases}</div>
      ` : ""}

      ${items ? `
        <div class="popup-section-title">Items requeridos</div>
        <div>${items}</div>
      ` : ""}

      ${consumibles ? `
        <div class="popup-section-title">Consumibles recomendados</div>
        <div>${consumibles}</div>
      ` : ""}

      <div>
        ${info.link_info && info.link_info !== "#" ? `
          <a href="${info.link_info}" target="_blank" class="popup-btn popup-btn-primary">📚 Ver información</a>
        ` : ""}
        ${info.link_registro && info.link_registro !== "#" ? `
          <a href="${info.link_registro}" target="_blank" class="popup-btn popup-btn-secondary">📋 Registro</a>
        ` : ""}
      </div>
    </div>
  `;

  overlay.querySelector(".popup-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ── Render horario ─────────────────────────────────────────
function renderSchedule() {
  const container = document.getElementById("schedule-container");
  const weekLabel = document.getElementById("schedule-week-label");
  if (!container) return;

  const lunes = getLunes(semanaOffset);
  const dias  = Array.from({ length: 7 }, (_, i) => addDays(lunes, i));
  const hoy   = new Date();

  if (weekLabel) weekLabel.textContent = formatSemanaLabel(lunes);

  container.innerHTML = "";

  // ── Horas (columna izquierda) ──────────────────────────
  const horasCol = document.createElement("div");
  horasCol.className = "schedule-hours-col";
  horasCol.innerHTML = `<div class="schedule-hours-header"></div>`;

  // ── Días: header ──────────────────────────────────────
  const daysWrap = document.createElement("div");
  daysWrap.className = "schedule-days-wrap";

  const daysHeader = document.createElement("div");
  daysHeader.className = "schedule-days-header";

  dias.forEach(dia => {
    const esHoy = isSameDay(dia, hoy);
    const cell  = document.createElement("div");
    cell.className = "schedule-day-header-cell" + (esHoy ? " today" : "");
    cell.innerHTML = `
      <div class="schedule-day-name">${DIAS_CORTO[dia.getDay()]}</div>
      <div class="schedule-day-date">${formatFechaLabel(dia)}</div>
    `;
    daysHeader.appendChild(cell);
  });

  daysWrap.appendChild(daysHeader);

  // ── Body con scroll ───────────────────────────────────
  const bodyWrap = document.createElement("div");
  bodyWrap.className = "schedule-body-wrap";
  bodyWrap.id = "schedule-body";

  // Horas en scroll
  const horasScroll = document.createElement("div");
  horasScroll.className = "schedule-hours-scroll";
  for (let h = 0; h < 24; h++) {
    const slot = document.createElement("div");
    slot.className = "schedule-hour-slot";
    slot.style.height = "60px";
    slot.textContent = `${String(h).padStart(2,"0")}:00`;
    horasScroll.appendChild(slot);
  }

  // Grid de días
  const daysBody = document.createElement("div");
  daysBody.className = "schedule-days-body";
  daysBody.style.position = "relative";

  dias.forEach((dia, idx) => {
    const esHoy = isSameDay(dia, hoy);
    const col   = document.createElement("div");
    col.className = "schedule-day-col" + (esHoy ? " today" : "");
    col.style.minHeight = "1440px"; // 24 * 60px

    // Líneas de hora
    for (let h = 0; h < 24; h++) {
      const line = document.createElement("div");
      line.className = "schedule-hour-line";
      line.style.top = (h * 60) + "px";
      col.appendChild(line);
    }

    // Línea de "ahora" si es hoy
    if (esHoy && semanaOffset === 0) {
      const now    = new Date();
      const minutos= now.getHours() * 60 + now.getMinutes();
      const nowLine = document.createElement("div");
      nowLine.className = "schedule-now-line";
      nowLine.style.top = minutos + "px";
      col.appendChild(nowLine);
    }

    // Eventos de este día
    scheduleData.forEach(ev => {
      const inicio = toLocalDate(ev.fecha, ev.hora, "America/Lima");
      if (!isSameDay(inicio, dia)) return;

      const estado  = getEstado(inicio, ev.duracion);
      const minutos = inicio.getHours() * 60 + inicio.getMinutes();
      const altura  = ev.duracion * 60;

      const evEl = document.createElement("div");
      evEl.className = `schedule-event ${juegoClass(ev.juego)} ev-${estado}`;
      evEl.style.top    = minutos + "px";
      evEl.style.height = altura + "px";

      const horaStr = inicio.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12: true });
      evEl.innerHTML = `
        <div class="schedule-event-hora">${horaStr}</div>
        <div class="schedule-event-juego">${ev.juego}</div>
        <div class="schedule-event-nombre">${ev.evento}</div>
      `;

      evEl.addEventListener("click", () => showPopup(ev, inicio, estado));
      col.appendChild(evEl);
    });

    daysBody.appendChild(col);
  });

  bodyWrap.appendChild(horasScroll);
  bodyWrap.appendChild(daysBody);
  daysWrap.appendChild(bodyWrap);

  container.appendChild(horasCol);
  container.appendChild(daysWrap);

  // Scroll inicial a las 8am
  setTimeout(() => {
    const body = document.getElementById("schedule-body");
    if (body) body.scrollTop = 8 * 60;
  }, 50);
}

// ── Eventos activos para index.html ───────────────────────
// Se exporta para que index.js pueda usarlo
export function getEventosActivos(scheduleEvs, zonaBase) {
  const ahora  = new Date();
  const manana = new Date(ahora);
  manana.setDate(ahora.getDate() + 2);

  return scheduleEvs
    .map(ev => {
      const inicio = toLocalDate(ev.fecha, ev.hora, zonaBase);
      const estado = getEstado(inicio, ev.duracion);
      return { ...ev, inicio, estado };
    })
    .filter(ev => ev.estado === "activo" || (ev.estado === "futuro" && ev.inicio < manana))
    .sort((a, b) => a.inicio - b.inicio)
    .slice(0, 5);
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

    // Zona horaria
    const tzEl = document.getElementById("schedule-tz");
    if (tzEl) tzEl.innerHTML = `Horario en tu zona horaria: <span>${ZONA_USUARIO}</span>`;

    renderSchedule();

    // Navegación de semanas
    document.getElementById("schedule-prev")?.addEventListener("click", () => {
      semanaOffset--;
      renderSchedule();
    });
    document.getElementById("schedule-next")?.addEventListener("click", () => {
      semanaOffset++;
      renderSchedule();
    });

  } catch(e) {
    console.error("Error cargando schedule:", e);
  }
});