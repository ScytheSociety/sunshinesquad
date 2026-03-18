import { loadJson } from "../app.js";
import { getUser, apiFetch } from "../auth.js";

const DIAS_CORTO = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DIAS_GRID  = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const MESES      = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const ZONA_USER  = Intl.DateTimeFormat().resolvedOptions().timeZone;
const HORA_PX    = 38;
const HORAS      = 24;
const API        = "https://sunshinesquad.es/api";

let scheduleData   = [];
let activitiesData = {};
let semanaOffset   = 0;
let monthOffset    = 0;
let viewMode       = "week";
let filterGame     = "";

// ── Fechas ─────────────────────────────────────────────────────────
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

// ── Conversión timezone → local ────────────────────────────────────
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

// ── Estado ─────────────────────────────────────────────────────────
function estado(inicio, durH) {
  const ahora = new Date();
  const fin   = new Date(inicio.getTime() + (durH + 1) * 3600000);
  if (ahora < inicio) return "futuro";
  if (ahora < fin)    return "activo";
  return "pasado";
}

// ── Clase por juego ────────────────────────────────────────────────
function gj(juego) {
  const j = juego.toLowerCase();
  if (j.includes("ragnarok")) return "gj-ragnarok";
  if (j.includes("warcraft")) return "gj-wow";
  if (j.includes("lineage"))  return "gj-lineage";
  if (j.includes("throne"))   return "gj-throne";
  if (j.includes("brawl"))    return "gj-brawl";
  return "";
}

// ── Google Calendar link ───────────────────────────────────────────
function buildGCalUrl(ev, inicio) {
  const tz = ev.timezone || "UTC";
  // Convert to UTC for Google Calendar
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
  });
  const end  = new Date(inicio.getTime() + (ev.duracion || 1) * 3600000);
  function toGCalDt(d) {
    return d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
  }
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text:   `${ev.evento} (${ev.juego})`,
    dates:  `${toGCalDt(inicio)}/${toGCalDt(end)}`,
    details: activitiesData[ev.id]?.descripcion || "",
    location: "",
  });
  return `https://www.google.com/calendar/render?${params}`;
}

// ── Fragmentos (corta eventos que cruzan medianoche) ───────────────
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

// ── Popup ──────────────────────────────────────────────────────────
async function showPopup(ev, inicio, est) {
  const info = activitiesData[ev.id] || {};
  const cfg  = {
    futuro: { label:"🔵 Próximo",    bg:"rgba(99,102,241,.25)", border:"#6366f1" },
    activo: { label:"🟢 En curso",   bg:"rgba(34,197,94,.25)",  border:"#22c55e" },
    pasado: { label:"⚫ Finalizado", bg:"rgba(100,116,139,.2)", border:"#64748b" }
  }[est];

  const hora       = inicio.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
  const fecha      = inicio.toLocaleDateString("es", { weekday:"long", day:"numeric", month:"long" });
  const tz         = ev.timezone || "America/Lima";
  const horaServer = new Date(`${ev.fecha}T${ev.hora}:00`).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
  const tzLabel    = tz === "UTC" ? "UTC" : tz.split("/")[1]?.replace(/_/g," ") || tz;
  const tags  = arr => (arr||[]).map(x => `<span class="popup-tag">${x}</span>`).join("");
  const gcalUrl = buildGCalUrl(ev, inicio);

  const el = document.createElement("div");
  el.className = "popup-overlay";
  el.innerHTML = `
    <div class="popup-box">
      <button class="popup-close">✕</button>
      <div class="popup-badge" style="background:${cfg.bg};border:1px solid ${cfg.border};color:#fff;">${cfg.label}</div>
      <div class="popup-title">${info.nombre || ev.evento}</div>
      <div class="popup-sub">${ev.juego} · ${fecha} · ${hora} · ~${ev.duracion}h</div>
      <div class="popup-sub" style="font-size:.75rem;color:rgba(255,255,255,.35);margin-top:-.7rem;">🕐 Server time: ${horaServer} ${tzLabel}</div>
      ${info.descripcion ? `<div class="popup-label">Descripción</div><div class="popup-text">${info.descripcion}</div>` : ""}
      ${info.nivel_minimo ? `<div class="popup-label">Nivel mínimo</div><div class="popup-text">${info.nivel_minimo}</div>` : ""}
      ${(info.clases||[]).length ? `<div class="popup-label">Clases</div><div>${tags(info.clases)}</div>` : ""}
      ${(info.items_requeridos||[]).length ? `<div class="popup-label">Items requeridos</div><div>${tags(info.items_requeridos)}</div>` : ""}
      ${(info.consumibles||[]).length ? `<div class="popup-label">Consumibles</div><div>${tags(info.consumibles)}</div>` : ""}
      <!-- RSVP section -->
      <div class="popup-label">Asistencia</div>
      <div id="rsvp-section" style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
        <span id="rsvp-count" style="font-size:.82rem;color:rgba(255,255,255,.45);">Cargando…</span>
      </div>
      <div class="popup-actions">
        ${info.link_info && info.link_info !== "#" ? `<a href="${info.link_info}" target="_blank" class="popup-btn">📚 Ver información</a>` : ""}
        ${info.link_registro && info.link_registro !== "#" ? `<a href="${info.link_registro}" target="_blank" class="popup-btn">📋 Registro</a>` : ""}
        <a href="${gcalUrl}" target="_blank" class="popup-btn" style="background:rgba(66,133,244,.12);border-color:rgba(66,133,244,.35);color:#93c5fd;">
          📅 Google Calendar
        </a>
      </div>
    </div>`;
  el.querySelector(".popup-close").onclick = () => el.remove();
  el.onclick = e => { if (e.target === el) el.remove(); };
  document.body.appendChild(el);

  // Load RSVP async
  loadRSVP(ev.id, est, el);
}

async function loadRSVP(eventId, est, popupEl) {
  const countEl   = popupEl.querySelector("#rsvp-count");
  const sectionEl = popupEl.querySelector("#rsvp-section");
  if (!countEl || !sectionEl) return;

  try {
    const res = await fetch(`${API}/schedule/${eventId}/rsvp`);
    if (!res.ok) { countEl.textContent = "No disponible"; return; }
    const data = await res.json();

    const names = data.users.slice(0, 8).map(u => u.username).join(", ");
    const extra = data.count > 8 ? ` +${data.count - 8} más` : "";
    countEl.innerHTML = data.count
      ? `<span style="color:#a5b4fc;font-weight:700;">${data.count}</span> <span style="color:rgba(255,255,255,.4);">asistiré${data.count === 1 ? "" : "n"}</span>
         ${names ? `<span style="color:rgba(255,255,255,.3);font-size:.75rem;"> · ${names}${extra}</span>` : ""}`
      : `<span style="color:rgba(255,255,255,.35);">Nadie confirmó aún</span>`;

    // RSVP button (only for future events, logged in)
    const user = getUser();
    if (!user || est === "pasado") return;

    const myRsvp = data.users.some(u => u.user_id === user.id);
    const btn = document.createElement("button");
    btn.id = "rsvp-btn";
    btn.className = "popup-btn";
    btn.style.cssText = myRsvp
      ? "background:rgba(34,197,94,.15);border-color:rgba(34,197,94,.4);color:#86efac;"
      : "background:rgba(99,102,241,.15);border-color:rgba(99,102,241,.4);color:#a5b4fc;";
    btn.textContent = myRsvp ? "✅ Asistiré (cancelar)" : "🙋 Confirmar asistencia";
    sectionEl.appendChild(btn);

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "…";
      const method = myRsvp ? "DELETE" : "POST";
      const res2 = await apiFetch(`/schedule/${eventId}/rsvp`, { method });
      if (!res2) return; // redirect to login
      const d2 = await res2.json();
      if (d2.ok !== undefined) loadRSVP(eventId, est, popupEl); // reload
    });
  } catch {
    countEl.textContent = "No disponible";
  }
}

// ── Vista SEMANA ───────────────────────────────────────────────────
function filterEvents(events) {
  if (!filterGame) return events;
  return events.filter(ev => ev.juego?.toLowerCase().includes(filterGame.toLowerCase()));
}

function render() {
  const outer = document.getElementById("schedule-outer");
  if (!outer) return;

  const lunes = getLunes(semanaOffset);
  const dias  = Array.from({ length:7 }, (_,i) => addDays(lunes, i));
  const hoy   = new Date();
  const dom   = addDays(lunes, 6);

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

  const headDaysHTML = dias.map(d => {
    const esHoy = isSameDay(d, hoy);
    return `<div class="head-day${esHoy ? " today" : ""}">
      <div class="hd-name">${DIAS_CORTO[d.getDay()]}</div>
      <div class="hd-date">${fmtCorto(d)}</div>
    </div>`;
  }).join("");

  const horasHTML = Array.from({length:HORAS}, (_,h) =>
    `<div class="hour-lbl" style="height:${HORA_PX}px;">${String(h).padStart(2,"0")}:00</div>`
  ).join("");

  const evData   = filterEvents(scheduleData);
  const todosFrag = evData.flatMap(ev => getFragmentos(ev));

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

  const lineasV = Array.from({length:7}, (_,i) =>
    `<div class="vr-line" style="left:${((i+1)/7*100).toFixed(4)}%;"></div>`
  ).join("");

  outer.innerHTML = `
    <div class="schedule-head">
      <div class="head-gutter"></div>
      <div class="head-days">${headDaysHTML}</div>
    </div>
    <div class="schedule-body">
      <div class="hours-col">${horasHTML}</div>
      <div class="days-grid">${lineasV}${colsHTML}</div>
    </div>`;

  outer.querySelectorAll(".sched-ev").forEach(el => {
    el.addEventListener("click", () => {
      const evData = scheduleData.find(e => e.id === el.dataset.evid);
      if (!evData) return;
      const ini = toLocal(evData.fecha, evData.hora);
      showPopup(evData, ini, estado(ini, evData.duracion));
    });
  });
}

// ── Vista MES ──────────────────────────────────────────────────────
function renderMonth() {
  const outer = document.getElementById("month-outer");
  if (!outer) return;

  const hoy    = new Date();
  const target = new Date(hoy.getFullYear(), hoy.getMonth() + monthOffset, 1);
  const year   = target.getFullYear();
  const month  = target.getMonth();

  // Update month label
  const labelEl = document.getElementById("month-label");
  if (labelEl) labelEl.innerHTML = `
    <div class="swl-year">${year}</div>
    <div class="swl-month">${MESES[month]}</div>`;

  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  // Start grid from Monday of the first week
  const startDow = firstDay.getDay(); // 0=Sun … 6=Sat
  const startOffset = startDow === 0 ? 6 : startDow - 1;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startOffset);

  // Build weeks (6 rows max)
  const weeks = [];
  let cursor = new Date(gridStart);
  while (cursor <= lastDay || weeks.length < 4) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    if (cursor > lastDay && weeks.length >= 4) break;
  }

  // Index events by date
  const evByDate = {};
  filterEvents(scheduleData).forEach(ev => {
    if (!ev.fecha) return;
    const ini = toLocal(ev.fecha, ev.hora, ev.timezone || "America/Lima");
    const key = `${ini.getFullYear()}-${ini.getMonth()}-${ini.getDate()}`;
    if (!evByDate[key]) evByDate[key] = [];
    evByDate[key].push({ ev, ini });
  });

  // Render header
  const headerHTML = DIAS_GRID.map(d =>
    `<div class="mcal-head-day">${d}</div>`
  ).join("");

  // Render weeks
  const weeksHTML = weeks.map(week =>
    `<div class="mcal-week">
      ${week.map(day => {
        const isThisMonth = day.getMonth() === month;
        const isToday     = isSameDay(day, hoy);
        const key         = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
        const dayEvents   = evByDate[key] || [];

        const chipsHTML = dayEvents.slice(0, 3).map(({ ev, ini }) => {
          const est = estado(ini, ev.duracion);
          return `<div class="mcal-chip ${gj(ev.juego)} st-${est}" data-evid="${ev.id}" title="${ev.evento} · ${ev.juego}">
            ${ev.evento}
          </div>`;
        }).join("") + (dayEvents.length > 3
          ? `<div class="mcal-chip-more">+${dayEvents.length - 3} más</div>` : "");

        return `<div class="mcal-day${isThisMonth ? "" : " other-month"}${isToday ? " today" : ""}">
          <div class="mcal-day-num">${day.getDate()}</div>
          <div class="mcal-chips">${chipsHTML}</div>
        </div>`;
      }).join("")}
    </div>`
  ).join("");

  outer.innerHTML = `
    <div class="mcal-grid">
      <div class="mcal-header">${headerHTML}</div>
      ${weeksHTML}
    </div>`;

  // Chip clicks
  outer.querySelectorAll(".mcal-chip[data-evid]").forEach(chip => {
    chip.addEventListener("click", () => {
      const evData = scheduleData.find(e => e.id === chip.dataset.evid);
      if (!evData) return;
      const ini = toLocal(evData.fecha, evData.hora);
      showPopup(evData, ini, estado(ini, evData.duracion));
    });
  });
}

// ── Carga horario ──────────────────────────────────────────────────
async function fetchHorario() {
  try {
    const res = await fetch(`${API}/schedule`, { cache:"no-store" });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return { eventos: data.eventos || [], actividades: data.actividades || {} };
  } catch {
    try {
      const [sched, acts] = await Promise.all([
        loadJson("data/schedule.json"),
        loadJson("data/activities.json"),
      ]);
      return { eventos: sched.eventos || [], actividades: acts };
    } catch {
      return { eventos: [], actividades: {} };
    }
  }
}

// ── Populate game filter ───────────────────────────────────────────
async function populateGameFilter() {
  const sel = document.getElementById("filter-game");
  if (!sel) return;
  try {
    const res = await fetch(`${API}/games`);
    if (!res.ok) return;
    const games = await res.json();
    games.filter(g => g.activo !== 0).forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.nombre;
      opt.textContent = `${g.emoji || "🎮"} ${g.nombre}`;
      sel.appendChild(opt);
    });
  } catch {}
  sel.addEventListener("change", () => {
    filterGame = sel.value;
    if (viewMode === "week") render();
    else renderMonth();
  });
}

// ── Switch views ───────────────────────────────────────────────────
function switchView(mode) {
  viewMode = mode;
  const weekNav   = document.getElementById("week-nav");
  const monthNav  = document.getElementById("month-nav");
  const weekOuter = document.getElementById("schedule-outer");
  const monthOuter = document.getElementById("month-outer");
  const legendNow = document.getElementById("legend-now");

  const tabWeek  = document.getElementById("tab-week");
  const tabMonth = document.getElementById("tab-month");

  if (mode === "week") {
    weekNav.style.display   = "";
    monthNav.style.display  = "none";
    weekOuter.style.display = "";
    monthOuter.style.display = "none";
    if (legendNow) legendNow.style.display = "";
    tabWeek.classList.add("btn-indigo","active");
    tabWeek.style.cssText = "";
    tabMonth.classList.remove("btn-indigo","active");
    tabMonth.style.cssText = "background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);";
    render();
  } else {
    weekNav.style.display   = "none";
    monthNav.style.display  = "";
    weekOuter.style.display = "none";
    monthOuter.style.display = "";
    if (legendNow) legendNow.style.display = "none";
    tabWeek.classList.remove("btn-indigo","active");
    tabWeek.style.cssText = "background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);";
    tabMonth.classList.add("btn-indigo","active");
    tabMonth.style.cssText = "";
    renderMonth();
  }
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const { eventos, actividades } = await fetchHorario();
    scheduleData   = eventos;
    activitiesData = actividades;

    const tzEl = document.getElementById("schedule-tz");
    if (tzEl) tzEl.innerHTML = `Horario en tu zona horaria: <span>${ZONA_USER}</span>`;

    render();
    populateGameFilter();

    // View tabs
    document.getElementById("tab-week")?.addEventListener("click",  () => switchView("week"));
    document.getElementById("tab-month")?.addEventListener("click", () => switchView("month"));

    // Week navigation
    document.getElementById("schedule-prev")?.addEventListener("click", async () => {
      semanaOffset--;
      const h = await fetchHorario();
      scheduleData = h.eventos; activitiesData = h.actividades;
      render();
    });
    document.getElementById("schedule-next")?.addEventListener("click", async () => {
      semanaOffset++;
      const h = await fetchHorario();
      scheduleData = h.eventos; activitiesData = h.actividades;
      render();
    });

    // Month navigation
    document.getElementById("month-prev")?.addEventListener("click", () => {
      monthOffset--;
      renderMonth();
    });
    document.getElementById("month-next")?.addEventListener("click", () => {
      monthOffset++;
      renderMonth();
    });

  } catch(e) { console.error("schedule:", e); }
});
