import { loadJson, repoRoot } from "../app.js";

const API = "https://sunshinesquad.es/api";

// ── Twitch ──────────────────────────────────────────────────────────
function buildPlayer(ch) { return `https://player.twitch.tv/?channel=${ch}&parent=${window.location.hostname}&autoplay=true&muted=false`; }
function buildChat(ch)   { return `https://www.twitch.tv/embed/${ch}/chat?parent=${window.location.hostname}`; }

function loadStream(ch) {
  document.getElementById("stream-iframe").src = buildPlayer(ch);
  document.getElementById("chat-iframe").src   = buildChat(ch);
  matchChatHeight();
}

function matchChatHeight() {
  const p = document.getElementById("player-wrap");
  const c = document.getElementById("chat-wrap");
  if (!p || !c) return;
  c.style.height = (p.offsetWidth * 9 / 16) + "px";
}
window.addEventListener("resize", matchChatHeight);

function renderChannels(channels) {
  const list = document.getElementById("channel-list");
  if (!list || !channels.length) return;
  channels.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn-ss";
    btn.textContent = item.name;
    btn.style.cssText = "font-size:.78rem;padding:.3rem .65rem;display:block;width:100%;margin-bottom:6px;text-align:left;";
    btn.addEventListener("click", () => {
      list.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadStream(item.channel);
    });
    list.appendChild(btn);
    if (idx === 0) { btn.classList.add("active"); loadStream(item.channel); }
  });
  matchChatHeight();
}

// ── Timezone helpers ────────────────────────────────────────────────
function toLocal(fechaISO, horaStr, timezone = "America/Lima") {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
  });
  const utcRef = new Date(`${fechaISO}T${horaStr}:00Z`);
  const parts  = fmt.formatToParts(utcRef).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  const tzDate = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
  return new Date(utcRef.getTime() + (utcRef - tzDate));
}
function getEstado(inicio, durH) {
  const ahora = new Date();
  const fin   = new Date(inicio.getTime() + (durH + 1) * 3600000);
  if (ahora < inicio) return "futuro";
  if (ahora < fin)    return "activo";
  return "pasado";
}

// ── Popup de evento (home) — igual al del calendario ─────────────────
function buildHomeGCalUrl(ev, inicio) {
  const end = new Date(inicio.getTime() + (ev.duracion || 1) * 3600000);
  const toGCalDt = d => d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
  const params = new URLSearchParams({
    action: "TEMPLATE", text: `${ev.evento} (${ev.juego})`,
    dates: `${toGCalDt(inicio)}/${toGCalDt(end)}`,
    details: ev.description || "", location: "",
  });
  return `https://www.google.com/calendar/render?${params}`;
}

function showHomeEventPopup(ev) {
  const inicio     = toLocal(ev.fecha, ev.hora, ev.timezone || "America/Lima");
  const est        = getEstado(inicio, ev.duracion);
  const utcHora    = inicio.toLocaleTimeString("es", { hour:"2-digit", minute:"2-digit", hour12:false, timeZone:"UTC" });
  const utcFecha   = inicio.toLocaleDateString("es", { weekday:"long", day:"numeric", month:"long", timeZone:"UTC" });
  const localHora  = inicio.toLocaleTimeString("es", { hour:"2-digit", minute:"2-digit", hour12:false });
  const localFecha = inicio.toLocaleDateString("es", { weekday:"long", day:"numeric", month:"long" });
  const gcalUrl    = buildHomeGCalUrl(ev, inicio);
  const cfg = {
    futuro: { label:"🔵 Activo",     bg:"rgba(99,102,241,.25)", border:"#6366f1" },
    activo: { label:"🟢 En Curso",   bg:"rgba(34,197,94,.25)",  border:"#22c55e" },
    pasado: { label:"⚫ Finalizado", bg:"rgba(100,116,139,.2)", border:"#64748b" }
  }[est] || { label:"🔵 Activo", bg:"rgba(99,102,241,.25)", border:"#6366f1" };

  const pubByName   = ev.published_by_username || "";
  const pubByAvatar = ev.published_by_avatar   || "";
  const desc        = ev.description || "";
  const puntos      = ev.activity_points || 0;
  const dific       = ev.difficulty || "";

  const descHtml = (() => {
    if (!desc) return "";
    const lines = desc.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return "";
    return `<div class="popup-label">📋 Recomendaciones</div><div class="popup-rec">${lines.map((l,i)=>`<div class="popup-rec-item">${i+1}. ${l}</div>`).join("")}</div>`;
  })();
  const pubHtml = pubByName
    ? `<div class="popup-pub">${pubByAvatar?`<img src="${pubByAvatar}" class="popup-pub-avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">`:""}<span class="popup-pub-name">${pubByName}</span></div>`
    : "";

  const imgHtml = ev.activity_image
    ? `<img src="${ev.activity_image}" style="width:60px;height:60px;object-fit:contain;border-radius:10px;flex-shrink:0;background:rgba(255,255,255,.05);" loading="lazy" onerror="this.style.display='none'">`
    : "";

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.innerHTML = `<div class="popup-box">
    <button class="popup-close">✕</button>
    <div style="display:flex;gap:12px;align-items:flex-start;">
      <div style="flex:1;min-width:0;">
        <div class="popup-badge" style="background:${cfg.bg};border:1px solid ${cfg.border};color:#fff;">${cfg.label}</div>
        <div class="popup-title">${ev.evento}</div>
        <div class="popup-sub popup-game">${ev.juego}</div>
      </div>
      ${imgHtml}
    </div>
    <div class="popup-sub">🕐 UTC: ${utcFecha} · ${utcHora}</div>
    <div class="popup-sub">📍 Tu zona: ${localFecha} · ${localHora} (~${ev.duracion}h)</div>
    ${dific  ? `<div class="popup-sub">⚔️ Dificultad: ${dific}</div>` : ""}
    ${puntos ? `<div class="popup-sub">⭐ ${puntos} puntos de logro</div>` : ""}
    ${pubHtml}${descHtml}
    <div id="home-rsvp-section" style="margin-top:1rem;"><span style="font-size:.8rem;color:rgba(255,255,255,.35);">Cargando asistencia…</span></div>
    <div class="popup-actions">
      <a href="${gcalUrl}" target="_blank" class="popup-btn" style="background:rgba(66,133,244,.12);border-color:rgba(66,133,244,.35);color:#93c5fd;">📅 Google Calendar</a>
    </div>
  </div>`;
  overlay.querySelector(".popup-close").onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  loadHomeRSVP(ev, overlay);
}

async function loadHomeRSVP(ev, overlayEl) {
  const sectionEl = overlayEl.querySelector("#home-rsvp-section");
  if (!sectionEl) return;
  if (ev.source !== "bot" || !ev.bot_id) { sectionEl.innerHTML = ""; return; }
  try {
    const res  = await fetch(`${API}/schedule/bot/${ev.bot_id}/rsvp`);
    if (!res.ok) { sectionEl.innerHTML = `<span class="rsvp-empty">No disponible</span>`; return; }
    const data  = await res.json();
    let html    = "";
    // Solo contar main + free (banca no cuenta como participante)
    const total = (data.users || []).filter(u => u.slot_type !== "bench").length;
    const max   = data.max || 0;

    if (total > 0 || max > 0) {
      const countLabel = max > 0
        ? `👥 <strong>${total}</strong>/${max} participantes`
        : `👥 <strong>${total}</strong> participante${total !== 1 ? "s" : ""}`;
      html += `<div class="rsvp-header" style="margin-bottom:.4rem;">${countLabel}</div>`;
      if (max > 0) {
        const pct = Math.min(100, Math.round(total / max * 100));
        html += `<div class="rsvp-progress-wrap">
          <div class="rsvp-progress-bar"><div class="rsvp-progress-fill" style="width:${pct}%"></div></div>
          <span class="rsvp-progress-label">${pct}%</span>
        </div>`;
      }
    }

    const userRow = (u, badge) => {
      const avatar  = u.avatar_url || `https://cdn.discordapp.com/embed/avatars/0.png`;
      const charTxt = u.character_name
        ? `${u.class_emoji || "⚔️"} ${u.character_name} <span class="rsvp-lv">lv${u.character_level}</span>`
        : `<span style="opacity:.4">Sin personaje</span>`;
      const cls = { "Principal":"principal","Libre":"libre","Comodín":"wildcard","Banca":"bench","Banca Vol.":"bench-vol" }[badge] || "libre";
      return `<div class="rsvp-user-row">
        <img src="${avatar}" class="rsvp-avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        <div class="rsvp-user-info"><span class="rsvp-char">${charTxt}</span><span class="rsvp-username">@${u.username || u.discord_user_id}</span></div>
        <span class="rsvp-type ${cls}">${badge}</span>
      </div>`;
    };

    const mainUsers = data.users.filter(u => u.slot_type === "main" && !u.is_wildcard);
    if (mainUsers.length) {
      const byRole = {};
      mainUsers.forEach(u => {
        const key = u.role_name || "Sin rol";
        if (!byRole[key]) byRole[key] = { emoji: u.role_emoji || "", order: u.role_display_order ?? 99, users: [] };
        byRole[key].users.push(u);
      });
      Object.entries(byRole).sort(([,a],[,b]) => a.order - b.order).forEach(([roleName, group]) => {
        html += `<div class="rsvp-role-label">${group.emoji} ${roleName} (${group.users.length})</div><div class="rsvp-list">`;
        group.users.forEach(u => { html += userRow(u, "Principal"); });
        html += `</div>`;
      });
    }

    const freeUsers = data.users.filter(u => u.slot_type === "free" && !u.is_wildcard);
    if (freeUsers.length) {
      html += `<div class="rsvp-role-label">🆓 Libre (${freeUsers.length})</div><div class="rsvp-list">`;
      freeUsers.forEach(u => { html += userRow(u, "Libre"); });
      html += `</div>`;
    }

    const wildcards = data.users.filter(u => u.is_wildcard);
    const benchNorm = data.users.filter(u => u.slot_type === "bench" && !u.is_wildcard && !u.bench_voluntary);
    const benchVol  = data.users.filter(u => u.slot_type === "bench" && !u.is_wildcard && u.bench_voluntary);
    const bancaTotal = wildcards.length + benchNorm.length + benchVol.length;
    if (bancaTotal > 0) {
      html += `<div class="rsvp-role-label">⏳ Banca (${bancaTotal})</div><div class="rsvp-list">`;
      wildcards.forEach(u => { html += userRow(u, "Comodín"); });
      benchNorm.forEach(u => { html += userRow(u, "Banca"); });
      benchVol.forEach(u => { html += userRow(u, "Banca Vol."); });
      html += `</div>`;
    }

    if (!data.users.length) html += `<div class="rsvp-empty">Nadie inscripto aún</div>`;
    sectionEl.innerHTML = html;
  } catch {
    sectionEl.innerHTML = `<span class="rsvp-empty">No disponible</span>`;
  }
}

// ── Próximos Eventos ────────────────────────────────────────────────
function renderEventos(eventos) {
  const el = document.getElementById("eventos-content");
  if (!el) return;
  const ahora  = new Date();
  const limite = new Date(ahora.getTime() + 7 * 24 * 3600000);
  const items  = eventos
    .map(ev => ({ ...ev, inicio: toLocal(ev.fecha, ev.hora, ev.timezone || "America/Lima") }))
    .map(ev => ({ ...ev, estado: getEstado(ev.inicio, ev.duracion) }))
    .filter(ev => ev.estado !== "pasado" && ev.inicio <= limite)
    .sort((a, b) => a.inicio - b.inicio)
    .slice(0, 3);
  if (!items.length) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.8rem;">Sin eventos próximos.</div>`; return; }
  const cfg = { activo:{ dot:"#22c55e" }, futuro:{ dot:"#a5b4fc" } };
  const C   = (2 * Math.PI * 16).toFixed(2); // donut circumference r=16

  el.innerHTML = items.map(ev => {
    const c    = cfg[ev.estado] || cfg.futuro;
    const hora = ev.inicio.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
    const fLbl = ev.inicio.toLocaleDateString("es", { weekday:"short", day:"numeric", month:"short" });
    const donutHtml = (ev.source === "bot" && ev.bot_id)
      ? `<div class="ev-donut" style="flex-shrink:0;display:flex;align-items:center;justify-content:center;width:44px;height:44px;">
           <svg width="44" height="44" viewBox="0 0 44 44">
             <circle cx="22" cy="22" r="16" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="5"/>
             <text x="22" y="27" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.25)" font-family="system-ui,sans-serif">?</text>
           </svg>
         </div>`
      : "";
    return `<div data-evid="${ev.id}" style="display:flex;gap:8px;align-items:center;margin-bottom:.6rem;cursor:pointer;padding:.3rem .4rem;border-radius:8px;transition:background .12s;" onmouseenter="this.style.background='rgba(255,255,255,.04)'" onmouseleave="this.style.background=''">
      <div style="width:7px;height:7px;border-radius:50%;background:${c.dot};flex-shrink:0;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:.8rem;font-weight:700;color:#fff;">${ev.juego}</div>
        <div style="font-size:.72rem;color:rgba(255,255,255,.5);">${ev.evento}</div>
        <div style="font-size:.66rem;color:rgba(255,255,255,.3);">${fLbl} · ${hora}</div>
      </div>
      ${donutHtml}
    </div>`;
  }).join("");

  // Click handlers
  items.forEach(ev => {
    el.querySelector(`[data-evid="${ev.id}"]`)?.addEventListener("click", () => showHomeEventPopup(ev));
  });

  // Async load donuts
  items.forEach(ev => {
    if (ev.source !== "bot" || !ev.bot_id) return;
    const donutEl = el.querySelector(`[data-evid="${ev.id}"] .ev-donut`);
    if (!donutEl) return;
    fetch(`${API}/schedule/bot/${ev.bot_id}/rsvp`).then(r => r.json()).then(data => {
      const total = (data.users || []).filter(u => u.slot_type !== "bench").length;
      const max   = data.max || 0;
      if (total <= 0 && max <= 0) { donutEl.innerHTML = ""; return; }
      // pct: si hay max usamos la proporción; si no, mostramos arco completo
      const pct    = max > 0 ? Math.min(1, total / max) : 1;
      const offset = (C * (1 - pct)).toFixed(2);
      const color  = pct < 0.5 ? "#6366f1" : pct < 0.85 ? "#f59e0b" : "#22c55e";
      donutEl.innerHTML = `<svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="16" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="5"/>
        <circle cx="22" cy="22" r="16" fill="none" stroke="${color}" stroke-width="5"
          stroke-dasharray="${C}" stroke-dashoffset="${offset}"
          stroke-linecap="round" transform="rotate(-90 22 22)"/>
        <text x="22" y="27" text-anchor="middle" font-size="12" font-weight="800" fill="white" font-family="system-ui,sans-serif">${total}</text>
      </svg>`;
    }).catch(() => { donutEl.innerHTML = ""; });
  });
}

// ── MVP Tracker ─────────────────────────────────────────────────────
let mvpTimer = null;
function fmtCountdown(ms) {
  if (ms <= 0) return "¡Spawneando!";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h > 0 ? `${h}h` : null, `${String(m).padStart(2,"0")}m`, `${String(s).padStart(2,"0")}s`].filter(Boolean).join(" ");
}
async function renderMVP() {
  const el    = document.getElementById("mvp-content");
  const badge = document.getElementById("mvp-live-badge");
  if (!el) return;
  try {
    const mvp = await fetch(`${API}/mvp/next`).then(r => r.json());
    if (!mvp?.respawn_at) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.8rem;">Sin MVPs próximamente.</div>`; return; }
    const respawnDate = new Date(mvp.respawn_at);
    if (mvpTimer) clearInterval(mvpTimer);
    mvpTimer = setInterval(() => {
      const cd = document.getElementById("mvp-countdown");
      if (!cd) { clearInterval(mvpTimer); return; }
      const diff = respawnDate - new Date();
      cd.textContent = fmtCountdown(diff);
      if (badge) badge.style.display = diff <= 5 * 60000 ? "inline" : "none";
    }, 1000);
    const diff = respawnDate - new Date();
    el.innerHTML = `<div class="d-flex align-items-center gap-2">
      ${mvp.image_url ? `<img src="${mvp.image_url}" alt="${mvp.boss_name}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;background:rgba(255,255,255,.05);" loading="lazy">` : ""}
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:.88rem;color:#fff;">${mvp.boss_name}</div>
        <div style="font-size:.72rem;color:rgba(255,255,255,.35);">📍 ${mvp.map || "?"}</div>
        <div id="mvp-countdown" style="font-size:1.1rem;font-weight:900;font-variant-numeric:tabular-nums;color:#fbbf24;">${fmtCountdown(diff)}</div>
      </div>
    </div>`;
  } catch { el.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:.8rem;">MVP Tracker no disponible.</div>`; }
}

// ── Cumpleaños ──────────────────────────────────────────────────────
async function renderBirthdays() {
  const el = document.getElementById("birthday-content");
  if (!el) return;
  try {
    const all   = await fetch(`${API}/birthdays/all`).then(r => r.json());
    const items = all.slice(0, 5);
    if (!items.length) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.8rem;">Sin cumpleaños próximos.</div>`; return; }
    const MESES_CORTO = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    el.innerHTML = items.map(b => {
      const isHoy   = b.dias_faltantes === 0;
      const label   = isHoy ? "🎉 ¡Hoy!" : `en ${b.dias_faltantes}d`;
      const color   = isHoy ? "#fde047" : "rgba(255,255,255,.5)";
      const dateStr = (b.birth_month && b.birth_day)
        ? `${b.birth_day} ${MESES_CORTO[(b.birth_month||1)-1]}`
        : "";
      const bg      = isHoy ? "background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:10px;padding:.4rem .5rem;" : "padding:.2rem 0;";
      const avatar  = b.avatar || b.avatar_url;
      return `<div class="d-flex align-items-center gap-2 mb-2" style="${bg}">
        ${avatar ? `<img src="${avatar}" width="30" height="30" style="border-radius:50%;object-fit:cover;border:2px solid ${isHoy?"rgba(251,191,36,.5)":"rgba(255,255,255,.1)"};" loading="lazy">` : `<div style="width:30px;height:30px;border-radius:50%;background:rgba(99,102,241,.3);display:flex;align-items:center;justify-content:center;font-size:.8rem;">🎂</div>`}
        <div style="flex:1;min-width:0;">
          <div style="font-size:.82rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.username}</div>
          <div style="font-size:.7rem;color:rgba(255,255,255,.35);">${dateStr}</div>
        </div>
        <div style="font-size:.72rem;font-weight:700;color:${color};flex-shrink:0;">${label}</div>
      </div>`;
    }).join("");
  } catch { el.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:.8rem;">No disponible.</div>`; }
}

// ── Ranking ─────────────────────────────────────────────────────────
const MEDALLAS = ["🥇","🥈","🥉","4️⃣","5️⃣"];
async function renderRanking() {
  const el = document.getElementById("ranking-content");
  if (!el) return;
  try {
    const items = await fetch(`${API}/ranking?limit=5`).then(r => r.json());
    if (!items.length) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.8rem;">Sin datos.</div>`; return; }
    const perfilBase = `${repoRoot()}pages/perfil/perfil.html`;
    el.innerHTML = items.map((u, i) => `
      <a href="${perfilBase}?id=${u.discord_id}" style="display:flex;align-items:center;gap:8px;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,.05);text-decoration:none;transition:background .12s;border-radius:6px;" onmouseenter="this.style.background='rgba(255,255,255,.04)'" onmouseleave="this.style.background=''">
        <div style="font-size:.95rem;min-width:22px;text-align:center;">${MEDALLAS[i]}</div>
        ${u.avatar_url ? `<img src="${u.avatar_url}" width="28" height="28" style="border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.1);" loading="lazy">` : `<div style="width:28px;height:28px;border-radius:50%;background:rgba(99,102,241,.2);"></div>`}
        <div style="flex:1;min-width:0;font-weight:700;font-size:.8rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.username}</div>
        <div style="font-size:.85rem;font-weight:900;color:#fbbf24;">${u.puntos_totales?.toLocaleString() ?? 0}</div>
      </a>`).join("");
  } catch { el.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:.8rem;">No disponible.</div>`; }
}

// ── Carousel helpers genéricos ───────────────────────────────────────
function buildCarousel({ prevId, nextId, trackId, dotsId, viewportSelector, items, renderCard, getVisible }) {
  const track = document.getElementById(trackId);
  const dots  = document.getElementById(dotsId);
  if (!track || !items.length) return;

  let idx = 0;

  function getCardWidth() {
    const vp = document.querySelector(viewportSelector);
    if (!vp) return 160;
    const vis = getVisible();
    return Math.floor((vp.offsetWidth - 14 * (vis - 1)) / vis);
  }

  function update() {
    const visible = getVisible();
    const cardW   = getCardWidth();
    track.querySelectorAll(".carousel-card").forEach(c => { c.style.width = cardW + "px"; });
    const max = Math.max(0, items.length - visible);
    idx = Math.max(0, Math.min(idx, max));
    track.style.transform = `translateX(-${idx * (cardW + 14)}px)`;
    if (dots) dots.querySelectorAll(".carousel-dot").forEach((d, i) => d.classList.toggle("active", i === idx));
    const prev = document.getElementById(prevId);
    const next = document.getElementById(nextId);
    const noScroll = items.length <= visible;
    if (prev) { prev.disabled = idx === 0; prev.style.visibility = noScroll ? "hidden" : "visible"; }
    if (next) { next.disabled = idx >= max; next.style.visibility = noScroll ? "hidden" : "visible"; }
    if (dots) dots.style.display = noScroll ? "none" : "flex";
  }

  track.innerHTML = items.map(item => renderCard(item)).join("");

  const visible   = getVisible();
  const dotsCount = Math.max(1, items.length - visible + 1);
  if (dots) {
    dots.innerHTML = Array.from({ length: dotsCount }, (_, i) =>
      `<button class="carousel-dot${i === 0 ? " active" : ""}"></button>`
    ).join("");
    dots.querySelectorAll(".carousel-dot").forEach((d, i) => {
      d.addEventListener("click", () => { idx = i; update(); });
    });
  }

  document.getElementById(prevId)?.addEventListener("click", () => {
    const max = Math.max(0, items.length - getVisible());
    idx = idx <= 0 ? max : idx - 1; update();
  });
  document.getElementById(nextId)?.addEventListener("click", () => {
    const max = Math.max(0, items.length - getVisible());
    idx = idx >= max ? 0 : idx + 1; update();
  });
  window.addEventListener("resize", update);
  requestAnimationFrame(update);
}

function getVisibleDefault() {
  const w = window.innerWidth;
  if (w < 576) return 1;
  if (w < 768) return 2;
  if (w < 992) return 3;
  return 5;
}

// ── Blog grid (home) ─────────────────────────────────────────────────
function defaultAvatarUrl(id) {
  try { return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(id) % 6n)}.png`; }
  catch { return `https://cdn.discordapp.com/embed/avatars/0.png`; }
}

async function renderBlogPosts() {
  const section = document.getElementById("blog-section");
  const grid    = document.getElementById("blog-grid");
  if (!section || !grid) return;
  try {
    const data  = await fetch(`${API}/blog?page=1`).then(r => r.json());
    const posts = (data.posts || []).slice(0, 3);
    if (!posts.length) return;
    section.style.display = "block";

    grid.innerHTML = posts.map(p => {
      const date    = new Date(p.created_at).toLocaleDateString("es", { day:"numeric", month:"long", year:"numeric" });
      const summary = p.resumen
        ? p.resumen.slice(0, 150) + (p.resumen.length > 150 ? "…" : "")
        : "";
      const avatar  = p.autor_avatar || defaultAvatarUrl(p.autor_id || "0");
      return `
        <a class="blog-home-card" href="pages/blog/post.html?slug=${p.slug}">
          <div class="blog-home-img-wrap">
            ${p.portada_url
              ? `<img src="${p.portada_url}" alt="${p.titulo}" class="blog-home-img" loading="lazy">`
              : `<div class="blog-home-img-placeholder">📝</div>`}
          </div>
          <div class="blog-home-body">
            ${p.juego ? `<span class="blog-home-tag">${p.juego}</span>` : ""}
            <div class="blog-home-title">${p.titulo}</div>
            ${summary ? `<div class="blog-home-summary">${summary}</div>` : ""}
            <div class="blog-home-meta">
              <img src="${avatar}" width="20" height="20"
                   style="border-radius:50%;object-fit:cover;flex-shrink:0;"
                   onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
              <span>${p.autor_nombre}</span>
              <span style="opacity:.4;">·</span>
              <span>${date}</span>
            </div>
          </div>
        </a>`;
    }).join("");
  } catch {}
}

// ── Juegos carousel (todos: guild + serie + sss) ──────────────────────
function renderJuegos(games, rootUrl) {
  const section = document.getElementById("juegos-section");
  const tagged  = games.filter(g => (g.guild || g.serie || g.sss) && g.activo !== 0);
  if (!tagged.length || !section) return;
  section.style.display = "block";
  buildCarousel({
    prevId: "juegos-carousel-prev", nextId: "juegos-carousel-next",
    trackId: "juegos-carousel-track", dotsId: null,
    viewportSelector: ".juegos-carousel-viewport",
    items: tagged,
    getVisible: getVisibleDefault,
    renderCard: g => {
      const gameUrl = rootUrl + g.url.replace(/^\//, "");
      const imgSrc  = g.imagen ? rootUrl + g.imagen : null;
      const badges  = [
        g.guild ? `<span class="carousel-badge carousel-badge-guild">GUILD</span>` : "",
        g.serie ? `<span class="carousel-badge carousel-badge-serie">SERIE</span>` : "",
        g.sss   ? `<span class="carousel-badge" style="background:rgba(20,184,166,.15);border:1px solid rgba(20,184,166,.35);color:#5eead4;">SSS</span>` : "",
      ].filter(Boolean).join("");
      return `
        <a class="carousel-card" href="${gameUrl}" style="flex-shrink:0;">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="${g.nombre}" class="carousel-cover" loading="lazy">`
            : `<div class="carousel-cover-placeholder">🎮</div>`}
          <div class="carousel-info">
            <div class="carousel-name">${g.nombre}</div>
            ${badges ? `<div class="carousel-badges">${badges}</div>` : ""}
          </div>
        </a>`;
    }
  });
}

// ── Init ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const streams = await loadJson("data/streams.json");
    renderChannels(streams.channels);
  } catch(e) { console.error("streams.json:", e); }

  try {
    const res = await fetch(`${API}/schedule`);
    if (res.ok) {
      const data = await res.json();
      renderEventos(data.eventos || []);
    }
  } catch(e) { console.error("schedule API:", e); }

  try {
    const res    = await fetch(`${API}/games`);
    const juegos = res.ok ? await res.json() : [];
    renderJuegos(juegos, repoRoot());
  } catch(e) { console.error("games API:", e); }

  renderMVP();
  renderBirthdays();
  renderBlogPosts();
  renderRanking();
});
