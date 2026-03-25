import { loadJson } from "../app.js";
import { getUser, apiFetch } from "../auth.js";

const DIAS_CORTO = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DIAS_GRID  = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const MESES      = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const ZONA_USER  = Intl.DateTimeFormat().resolvedOptions().timeZone;
const HORA_PX       = 60;   // base para getFragmentos (no cambiar)
const HORA_PX_FULL  = 60;   // hora con eventos
const HORA_PX_EMPTY = 18;   // hora sin eventos (colapsada)
const HORAS         = 24;
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
      dia:    new Date(diaActual),
      topPx:  topMin * (HORA_PX / 60),
      altPx:  Math.max(durMin * (HORA_PX / 60), 20),
      topMin,
      durMin,
      hora:   new Date(inicioFrag),
      esCont: inicioFrag > ini.getTime(),
      ev
    });
    diaActual = new Date(finDia);
  }
  return frags;
}

// ── Alturas variables por hora ─────────────────────────────────────
function buildHourHeights(frags, dias) {
  const used = new Set();
  frags.forEach(f => {
    if (!dias.some(d => isSameDay(f.dia, d))) return;
    const sh = Math.floor(f.topMin / 60);
    const eh = Math.min(23, Math.floor((f.topMin + Math.max(f.durMin, 1)) / 60));
    for (let h = sh; h <= eh; h++) used.add(h);
  });
  return Array.from({length: 24}, (_, h) => used.has(h) ? HORA_PX_FULL : HORA_PX_EMPTY);
}

function minuteToPx(min, hh) {
  const h   = Math.min(23, Math.floor(min / 60));
  const rem = min % 60;
  let px = 0;
  for (let i = 0; i < h; i++) px += hh[i];
  px += (rem / 60) * hh[h];
  return px;
}

function durToPx(topMin, durMin, hh) {
  return minuteToPx(topMin + durMin, hh) - minuteToPx(topMin, hh);
}

// ── Popup ──────────────────────────────────────────────────────────
async function showPopup(ev, inicio, est) {
  const isBotEvent = ev.source === "bot";
  const info = (!isBotEvent && activitiesData[ev.id]) || {};
  const cfg  = {
    futuro: { label:"🔵 Próximo",    bg:"rgba(99,102,241,.25)", border:"#6366f1" },
    activo: { label:"🟢 En curso",   bg:"rgba(34,197,94,.25)",  border:"#22c55e" },
    pasado: { label:"⚫ Finalizado", bg:"rgba(100,116,139,.2)", border:"#64748b" }
  }[est];

  const horaLocal  = inicio.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:false });
  const fechaLocal = inicio.toLocaleDateString("es", { weekday:"long", day:"numeric", month:"long" });
  const tz         = ev.timezone || "America/Lima";
  const tzLabel    = tz === "UTC" ? "UTC" : tz.split("/")[1]?.replace(/_/g," ") || tz;
  const gcalUrl    = buildGCalUrl(ev, inicio);
  const tags       = arr => (arr||[]).map(x => `<span class="popup-tag">${x}</span>`).join("");

  // Descripción y metadatos según fuente
  const desc     = isBotEvent ? (ev.description || "") : (info.descripcion || "");
  const actName  = isBotEvent ? (ev.activity_name || ev.evento) : (info.nombre || ev.evento);
  const puntos      = isBotEvent ? (ev.activity_points || 0) : 0;
  const pubBy       = isBotEvent ? (ev.published_by || "") : "";
  const pubByName   = isBotEvent ? (ev.published_by_username || "") : "";
  const pubByAvatar = isBotEvent ? (ev.published_by_avatar || "") : "";
  const dific       = isBotEvent ? (ev.difficulty || "") : "";

  const el = document.createElement("div");
  el.className = "popup-overlay";
  // Recomendaciones como lista numerada
  const descHtml = (() => {
    if (!desc) return "";
    const lines = desc.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return "";
    const items = lines.map((l, i) => `<div class="popup-rec-item">${i+1}. ${l}</div>`).join("");
    return `<div class="popup-label">📋 Recomendaciones</div><div class="popup-rec">${items}</div>`;
  })();

  // Publicado por con avatar y nombre
  const pubHtml = pubByName
    ? `<div class="popup-pub">
        ${pubByAvatar ? `<img src="${pubByAvatar}" class="popup-pub-avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">` : ""}
        <span class="popup-pub-name">${pubByName}</span>
       </div>`
    : (pubBy ? `<div class="popup-sub">👤 Publicado por: <@${pubBy}></div>` : "");

  el.innerHTML = `
    <div class="popup-box">
      <button class="popup-close">✕</button>
      <div class="popup-badge" style="background:${cfg.bg};border:1px solid ${cfg.border};color:#fff;">${cfg.label}</div>
      <div class="popup-title">${actName}</div>
      <div class="popup-sub">${ev.juego} · ${fechaLocal} · ${horaLocal} · ~${ev.duracion}h</div>
      <div class="popup-sub popup-tz">🕐 ${tzLabel}: ${ev.hora}</div>
      ${dific ? `<div class="popup-sub">⚔️ Dificultad: ${dific}</div>` : ""}
      ${puntos ? `<div class="popup-sub">⭐ ${puntos} puntos de logro</div>` : ""}
      ${pubHtml}
      ${descHtml}
      ${!isBotEvent && info.nivel_minimo ? `<div class="popup-label">Nivel mínimo</div><div class="popup-text">${info.nivel_minimo}</div>` : ""}
      ${!isBotEvent && (info.clases||[]).length ? `<div class="popup-label">Clases</div><div>${tags(info.clases)}</div>` : ""}
      ${!isBotEvent && (info.items_requeridos||[]).length ? `<div class="popup-label">Items requeridos</div><div>${tags(info.items_requeridos)}</div>` : ""}
      ${!isBotEvent && (info.consumibles||[]).length ? `<div class="popup-label">Consumibles</div><div>${tags(info.consumibles)}</div>` : ""}
      <div id="rsvp-section" style="margin-top:1rem;">
        <span style="font-size:.8rem;color:rgba(255,255,255,.35);">Cargando asistencia…</span>
      </div>
      <div class="popup-actions">
        ${!isBotEvent && info.link_info && info.link_info !== "#" ? `<a href="${info.link_info}" target="_blank" class="popup-btn">📚 Ver información</a>` : ""}
        ${!isBotEvent && info.link_registro && info.link_registro !== "#" ? `<a href="${info.link_registro}" target="_blank" class="popup-btn">📋 Registro</a>` : ""}
        <a href="${gcalUrl}" target="_blank" class="popup-btn" style="background:rgba(66,133,244,.12);border-color:rgba(66,133,244,.35);color:#93c5fd;">
          📅 Google Calendar
        </a>
      </div>
    </div>`;
  el.querySelector(".popup-close").onclick = () => el.remove();
  el.onclick = e => { if (e.target === el) el.remove(); };
  document.body.appendChild(el);

  loadRSVP(ev.id, est, el, ev);
}

async function loadRSVP(eventId, est, popupEl, ev) {
  const sectionEl = popupEl.querySelector("#rsvp-section");
  if (!sectionEl) return;

  const isBotEvent = ev?.source === "bot";
  const botId      = ev?.bot_id;
  const rsvpUrl    = isBotEvent ? `${API}/schedule/bot/${botId}/rsvp` : `${API}/schedule/${eventId}/rsvp`;

  try {
    const headers = {};
    const token = localStorage.getItem("ss_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(rsvpUrl, { headers });
    if (!res.ok) { sectionEl.innerHTML = `<span class="rsvp-empty">No disponible</span>`; return; }
    const data = await res.json();

    // ── Participant list ───────────────────────────────────────
    let html = "";

    if (isBotEvent) {
      // Barra de progreso
      const total = data.count;
      const max   = data.max || 0;
      if (max > 0) {
        const pct = Math.min(100, Math.round(total / max * 100));
        html += `<div class="rsvp-progress-wrap">
          <div class="rsvp-progress-bar"><div class="rsvp-progress-fill" style="width:${pct}%"></div></div>
          <div class="rsvp-progress-label">${total}/${max} participantes · ${pct}%</div>
        </div>`;
      } else {
        html += `<div class="rsvp-header">👥 <strong>${total}</strong> participante${total !== 1 ? "s" : ""}</div>`;
      }

      // Separar main/wildcard vs banca
      const mainUsers  = data.users.filter(u => !u.bench_voluntary);
      const benchUsers = data.users.filter(u => u.bench_voluntary);

      const userRow = u => {
        const avatar  = u.avatar_url || `https://cdn.discordapp.com/embed/avatars/0.png`;
        const charTxt = u.character_name
          ? `${u.class_emoji || "⚔️"} ${u.character_name} <span class="rsvp-lv">lv${u.character_level}</span>`
          : `<span style="opacity:.4">Sin personaje</span>`;
        const badge = u.is_wildcard ? `<span class="rsvp-type wildcard">comodín</span>` : "";
        return `<div class="rsvp-user-row">
          <img src="${avatar}" class="rsvp-avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
          <div class="rsvp-user-info">
            <span class="rsvp-char">${charTxt}</span>
            <span class="rsvp-username">@${u.username || u.discord_user_id}</span>
          </div>
          ${badge}
        </div>`;
      };

      if (mainUsers.length) {
        // Agrupar por rol y ordenar por display_order
        const byRole = {};
        mainUsers.forEach(u => {
          const key = u.role_name || "Sin rol";
          if (!byRole[key]) byRole[key] = { emoji: u.role_emoji || "", order: u.role_display_order ?? 99, users: [] };
          byRole[key].users.push(u);
        });
        html += `<div class="rsvp-list">`;
        Object.entries(byRole)
          .sort(([,a], [,b]) => a.order - b.order)
          .forEach(([roleName, group]) => {
            if (Object.keys(byRole).length > 1 || roleName !== "Sin rol") {
              html += `<div class="rsvp-role-label">${group.emoji} ${roleName} (${group.users.length})</div>`;
            }
            group.users.forEach(u => { html += userRow(u); });
          });
        html += `</div>`;
      } else {
        html += `<div class="rsvp-empty">Nadie inscripto aún</div>`;
      }

      if (benchUsers.length) {
        html += `<div class="rsvp-role-label rsvp-bench-label">⏳ Banca (${benchUsers.length})</div>
          <div class="rsvp-list rsvp-bench-list">`;
        benchUsers.forEach(u => { html += userRow(u); });
        html += `</div>`;
      }
    } else {
      html += `<div class="rsvp-header">👥 <strong>${data.count}</strong> participante${data.count !== 1 ? "s" : ""}</div>`;
      if (data.count > 0) {
        const names = data.users.slice(0, 6).map(u => u.username).join(", ");
        const extra = data.count > 6 ? ` +${data.count - 6}` : "";
        html += `<div class="rsvp-list"><div class="rsvp-names">${names}${extra}</div></div>`;
      } else {
        html += `<div class="rsvp-empty">Nadie confirmado aún</div>`;
      }
    }

    sectionEl.innerHTML = html;

    // ── Registration form ──────────────────────────────────────
    if (est === "pasado") return;
    const user = getUser();
    if (!user) {
      sectionEl.insertAdjacentHTML("beforeend",
        `<div class="rsvp-login-hint">🔑 <a href="/pages/auth/login.html">Inicia sesión con Discord</a> para inscribirte</div>`);
      return;
    }

    if (!isBotEvent) {
      const myRsvp = data.users.some(u => u.user_id === user.id);
      _renderSimpleRsvp(sectionEl, myRsvp, eventId, est, popupEl, ev);
      return;
    }

    if (data.myRsvp) {
      _renderMyRegistration(sectionEl, data.myRsvp, botId, est, popupEl, ev, data.characters);
    } else {
      _renderRegisterForm(sectionEl, data.characters, botId, est, popupEl, ev);
    }
  } catch {
    sectionEl.innerHTML = `<span class="rsvp-empty">No disponible</span>`;
  }
}

function _renderSimpleRsvp(sectionEl, myRsvp, eventId, est, popupEl, ev) {
  const wrap = document.createElement("div");
  wrap.className = "rsvp-form";
  wrap.innerHTML = `<button class="rsvp-action-btn ${myRsvp ? "registered" : "primary"}">${myRsvp ? "✅ Inscrito · cancelar" : "🙋 Confirmar asistencia"}</button>`;
  sectionEl.appendChild(wrap);
  wrap.querySelector("button").addEventListener("click", async btn => {
    btn.target.disabled = true; btn.target.textContent = "…";
    await apiFetch(`/schedule/${eventId}/rsvp`, { method: myRsvp ? "DELETE" : "POST" });
    loadRSVP(eventId, est, popupEl, ev);
  });
}

function _renderRegisterForm(sectionEl, characters, botId, est, popupEl, ev) {
  const defaultChar = characters.find(c => c.is_main) || characters[0] || null;
  let selectedChar = defaultChar;

  const charHtml = characters.length ? `
    <div class="rsvp-form-label">Elige tu personaje:</div>
    <div class="rsvp-char-selector">
      ${characters.map(c => `
        <button class="char-pick${selectedChar?.id === c.id ? " active" : ""}"
                data-id="${c.id}" data-level="${c.level}">
          ${c.class_emoji || "⚔️"} ${c.character_name} <span>lv${c.level}</span>
        </button>`).join("")}
    </div>` : "";

  const formEl = document.createElement("div");
  formEl.className = "rsvp-form";
  formEl.innerHTML = `${charHtml}
    <div class="rsvp-btns">
      <button class="rsvp-action-btn primary" data-type="main">🙋 Inscribirse</button>
      <button class="rsvp-action-btn secondary" data-type="wildcard">🃏 Comodín</button>
      <button class="rsvp-action-btn secondary" data-type="bench">⏳ Banca</button>
    </div>`;
  sectionEl.appendChild(formEl);

  formEl.querySelectorAll(".char-pick").forEach(btn => {
    btn.addEventListener("click", () => {
      formEl.querySelectorAll(".char-pick").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedChar = { id: btn.dataset.id, level: btn.dataset.level };
    });
  });

  formEl.querySelectorAll("[data-type]").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true; btn.textContent = "…";
      const res = await apiFetch(`/schedule/bot/${botId}/rsvp`, {
        method: "POST",
        body: JSON.stringify({ character_id: selectedChar?.id || null, type: btn.dataset.type }),
      });
      if (res) loadRSVP(`bot-${botId}`, est, popupEl, ev);
    });
  });
}

function _renderMyRegistration(sectionEl, myRsvp, botId, est, popupEl, ev, characters) {
  const charTxt = myRsvp.character_name
    ? `${myRsvp.class_emoji || "⚔️"} ${myRsvp.character_name} (lv${myRsvp.character_level})`
    : "Sin personaje";
  const typeTxt = myRsvp.is_wildcard ? "🃏 Comodín" : myRsvp.bench_voluntary ? "⏳ Banca" : "🙋 Principal";

  const formEl = document.createElement("div");
  formEl.className = "rsvp-form";
  formEl.innerHTML = `
    <div class="rsvp-my-status">✅ ${typeTxt} · ${charTxt}</div>
    <div class="rsvp-btns">
      <button class="rsvp-action-btn secondary" id="btn-edit">✏️ Editar</button>
      <button class="rsvp-action-btn danger"     id="btn-cancel">❌ Cancelar</button>
    </div>`;
  sectionEl.appendChild(formEl);

  formEl.querySelector("#btn-edit").addEventListener("click", () => {
    formEl.remove();
    _renderRegisterForm(sectionEl, characters, botId, est, popupEl, ev);
  });

  formEl.querySelector("#btn-cancel").addEventListener("click", async btn => {
    btn.target.disabled = true; btn.target.textContent = "…";
    const res = await apiFetch(`/schedule/bot/${botId}/rsvp`, { method: "DELETE" });
    if (res) loadRSVP(`bot-${botId}`, est, popupEl, ev);
  });
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

  const evData    = filterEvents(scheduleData);
  const todosFrag = evData.flatMap(ev => getFragmentos(ev));

  // Alturas variables: horas con eventos = HORA_PX_FULL, vacías = HORA_PX_EMPTY
  const hourHeights = buildHourHeights(todosFrag, dias);
  const totalH      = hourHeights.reduce((a, b) => a + b, 0);

  const horasHTML = hourHeights.map((hpx, h) =>
    `<div class="hour-lbl" style="height:${hpx}px;">${String(h).padStart(2,"0")}:00</div>`
  ).join("");

  const colsHTML = dias.map(d => {
    const esHoy = isSameDay(d, hoy);

    // Líneas horizontales en posición acumulada
    const lineasH = Array.from({length:HORAS}, (_,h) => {
      const top = hourHeights.slice(0, h).reduce((a, b) => a + b, 0);
      return `<div class="hr-line" style="top:${top}px;"></div>`;
    }).join("");

    let nowHTML = "";
    if (esHoy && semanaOffset === 0) {
      const now    = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const px     = minuteToPx(nowMin, hourHeights);
      nowHTML = `<div class="now-line" style="top:${px}px;"></div>`;
    }

    const eventsHTML = todosFrag
      .filter(f => isSameDay(f.dia, d))
      .map(f => {
        const ev     = f.ev;
        const est    = estado(toLocal(ev.fecha, ev.hora, ev.timezone || "America/Lima"), ev.duracion);
        const hora   = f.hora.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:false });
        const topPx  = minuteToPx(f.topMin, hourHeights);
        const altPx  = Math.max(durToPx(f.topMin, Math.max(f.durMin, 1), hourHeights), 18);
        const imgHtml = ev.activity_image
          ? `<img class="ev-thumb" src="${ev.activity_image}" loading="lazy" onerror="this.style.display='none'">`
          : "";
        return `<div class="sched-ev ${gj(ev.juego)} st-${est}${ev.source === "bot" ? " ev-bot" : ""}"
                     style="top:${topPx}px;height:${altPx}px;"
                     data-evid="${ev.id}">
          ${!f.esCont
            ? `<div class="ev-inner">
                 <div class="ev-hora">${hora}</div>
                 <div class="ev-nombre">${ev.evento.toUpperCase()}</div>
                 <div class="ev-juego">${ev.juego}${ev.source === "bot" ? " 🤖" : ""}</div>
                 ${ev.published_by_username ? `<div class="ev-autor">${ev.published_by_username}</div>` : ""}
               </div>${imgHtml}`
            : `<div class="ev-cont">↑ continúa</div>`}
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
      <div class="days-grid" style="min-height:${totalH}px;">${lineasV}${colsHTML}</div>
    </div>`;

  outer.querySelectorAll(".sched-ev").forEach(el => {
    el.addEventListener("click", () => {
      const evData = scheduleData.find(e => e.id === el.dataset.evid);
      if (!evData) return;
      const ini = toLocal(evData.fecha, evData.hora, evData.timezone || "America/Lima");
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
      const ini = toLocal(evData.fecha, evData.hora, evData.timezone || "America/Lima");
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
    // Solo juegos del bot (tienen command_key)
    games.filter(g => g.activo !== 0 && g.command_key).forEach(g => {
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
