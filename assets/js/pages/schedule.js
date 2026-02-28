import { loadJson } from "../app.js";

// ── Nombres de días ────────────────────────────────────────
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DIAS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// ── Color por juego ────────────────────────────────────────
function colorClass(juego) {
  const j = juego.toLowerCase();
  if (j.includes("ragnarok"))  return "ev-ragnarok";
  if (j.includes("warcraft"))  return "ev-wow";
  if (j.includes("lineage"))   return "ev-lineage";
  if (j.includes("brawl"))     return "ev-brawl";
  if (j.includes("throne"))    return "ev-throne";
  return "ev-default";
}

// ── Convierte hora Peru a hora local del usuario ───────────
// dia: 0=Dom, 1=Lun ... 6=Sáb
// hora: "19:00"
function convertirALocal(dia, hora, zonaBase) {
  const [hh, mm] = hora.split(":").map(Number);

  // Usamos la semana actual para calcular bien el día
  const ahora = new Date();
  // Encontrar la fecha del próximo dia (o actual) en la semana
  const hoy = ahora.getDay(); // 0=Dom
  let diff = dia - hoy;
  // Tomamos la ocurrencia más próxima futura o hoy
  if (diff < 0) diff += 7;

  const fecha = new Date(ahora);
  fecha.setDate(ahora.getDate() + diff);
  fecha.setSeconds(0);
  fecha.setMilliseconds(0);

  // Crear la fecha en la zona base (Lima)
  const isoStr = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,"0")}-${String(fecha.getDate()).padStart(2,"0")}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00`;

  // Interpretar como hora Lima
  const enLima = new Date(new Date(isoStr).toLocaleString("en-US", { timeZone: zonaBase }));
  const diffMs  = new Date(isoStr) - enLima;
  const horaReal = new Date(new Date(isoStr).getTime() + diffMs);

  return horaReal;
}

// ── Formatear hora local ───────────────────────────────────
function formatHora(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatFecha(date) {
  return date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

// ── Render ─────────────────────────────────────────────────
function renderSchedule(eventos, zonaBase) {
  const container = document.getElementById("schedule-grid");
  const tzEl      = document.getElementById("schedule-tz");
  if (!container) return;

  // Mostrar zona del usuario
  const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (tzEl) {
    tzEl.innerHTML = `Horario en tu zona horaria: <span>${userTZ}</span> — Los eventos se muestran en tu hora local`;
  }

  const hoyDia = new Date().getDay();

  // Crear columna por cada día 0-6 (Dom-Sáb), empezando en Lunes
  const ordenDias = [1, 2, 3, 4, 5, 6, 0]; // Lun a Dom

  ordenDias.forEach(dia => {
    const col = document.createElement("div");
    col.className = "schedule-day" + (dia === hoyDia ? " today" : "");

    // Calcular fecha real de este día en la semana actual
    const ahora   = new Date();
    const hoy     = ahora.getDay();
    let diff      = dia - hoy;
    if (diff < 0) diff += 7;
    const fechaDia = new Date(ahora);
    fechaDia.setDate(ahora.getDate() + diff);

    col.innerHTML = `
      <div class="schedule-day-header">
        <div class="schedule-day-name">${DIAS_FULL[dia]}</div>
        <div class="schedule-day-date">${fechaDia.toLocaleDateString([], { day: "numeric", month: "short" })}</div>
      </div>
      <div class="schedule-day-events" id="day-${dia}"></div>
    `;
    container.appendChild(col);
  });

  // Insertar eventos en su columna convertidos a hora local
  eventos.forEach(ev => {
    const horaLocal = convertirALocal(ev.dia, ev.hora, zonaBase);
    const diaLocal  = horaLocal.getDay(); // puede cambiar de día al convertir

    const evEl = document.createElement("a");
    evEl.className = `schedule-event ${colorClass(ev.juego)}`;
    evEl.href = ev.url || "#";
    if (ev.url === "#") evEl.style.pointerEvents = "none"; // deshabilitado por ahora

    evEl.innerHTML = `
      <div class="schedule-event-hora">${formatHora(horaLocal)}</div>
      <div class="schedule-event-juego">${ev.juego}</div>
      <div class="schedule-event-nombre">${ev.evento}</div>
      <div class="schedule-event-dur">~${ev.duracion}h</div>
    `;

    const col = document.getElementById(`day-${diaLocal}`);
    if (col) col.appendChild(evEl);
  });
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await loadJson("data/schedule.json");
    renderSchedule(data.eventos, data.zona_base);
  } catch(e) {
    console.error("schedule.json:", e);
  }
});