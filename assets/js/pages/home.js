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

// ── Popup de evento (home) ───────────────────────────────────────────
async function showHomeEventPopup(ev) {
  const inicio = toLocal(ev.fecha, ev.hora, ev.timezone || "America/Lima");
  const utcHora  = inicio.toLocaleTimeString("es", { hour:"2-digit", minute:"2-digit", hour12:false, timeZone:"UTC" });
  const utcFecha = inicio.toLocaleDateString("es", { weekday:"long", day:"numeric", month:"long", timeZone:"UTC" });
  const localHora  = inicio.toLocaleTimeString("es", { hour:"2-digit", minute:"2-digit", hour12:false });
  const localFecha = inicio.toLocaleDateString("es", { weekday:"long", day:"numeric", month:"long" });
  const pubByName   = ev.published_by_username || "";
  const pubByAvatar = ev.published_by_avatar   || "";

  let rsvpHtml = "";
  if (ev.source === "bot" && ev.bot_id) {
    try {
      const r = await fetch(`${API}/schedule/bot/${ev.bot_id}/rsvp`);
      if (r.ok) {
        const d = await r.json();
        const total = d.count; const max = d.max || 0;
        if (max > 0) {
          const pct = Math.min(100, Math.round(total / max * 100));
          rsvpHtml = `<div style="display:flex;align-items:center;gap:.5rem;margin-top:.8rem;">
            <div style="flex:1;height:7px;background:rgba(255,255,255,.08);border-radius:999px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#6366f1,#22c55e);border-radius:999px;transition:width .6s;"></div>
            </div>
            <span style="font-size:.72rem;font-weight:700;color:rgba(255,255,255,.5);flex-shrink:0;">${total}/${max}</span>
          </div>`;
        } else if (total > 0) {
          rsvpHtml = `<div style="font-size:.75rem;color:rgba(255,255,255,.4);margin-top:.6rem;">👥 ${total} participante${total!==1?"s":""}</div>`;
        }
      }
    } catch {}
  }

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(5px);";
  overlay.innerHTML = `<div style="background:#0d1117;border:1px solid rgba(255,255,255,.13);border-radius:16px;padding:1.5rem;max-width:400px;width:100%;position:relative;max-height:85vh;overflow-y:auto;">
    <button style="position:absolute;top:.8rem;right:.8rem;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;" id="hep-close">✕</button>
    <div style="font-size:.82rem;font-weight:800;text-transform:uppercase;letter-spacing:.3px;color:#fff;margin-bottom:.15rem;">${ev.evento}</div>
    <div style="font-size:.78rem;color:rgba(255,255,255,.5);margin-bottom:.5rem;">${ev.juego}</div>
    <div style="font-size:.72rem;color:rgba(255,255,255,.35);margin-bottom:.15rem;">🕐 UTC: ${utcFecha} · ${utcHora}</div>
    <div style="font-size:.72rem;color:rgba(255,255,255,.35);margin-bottom:.6rem;">📍 Tu zona: ${localFecha} · ${localHora}</div>
    ${pubByName ? `<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.5rem;">${pubByAvatar?`<img src="${pubByAvatar}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;" onerror="this.remove()">`:""}<span style="font-size:.7rem;color:rgba(255,255,255,.4);">${pubByName}</span></div>` : ""}
    ${rsvpHtml}
  </div>`;
  overlay.querySelector("#hep-close").onclick = () => overlay.remove();
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
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
  el.innerHTML = items.map(ev => {
    const c    = cfg[ev.estado] || cfg.futuro;
    const hora = ev.inicio.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
    const fLbl = ev.inicio.toLocaleDateString("es", { weekday:"short", day:"numeric", month:"short" });
    return `<div data-evid="${ev.id}" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:.6rem;cursor:pointer;padding:.3rem .4rem;border-radius:8px;transition:background .12s;" onmouseenter="this.style.background='rgba(255,255,255,.04)'" onmouseleave="this.style.background=''" >
      <div style="width:7px;height:7px;border-radius:50%;background:${c.dot};margin-top:.35rem;flex-shrink:0;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:.8rem;font-weight:700;color:#fff;">${ev.juego}</div>
        <div style="font-size:.72rem;color:rgba(255,255,255,.5);">${ev.evento}</div>
        <div style="font-size:.66rem;color:rgba(255,255,255,.3);">${fLbl} · ${hora}</div>
      </div>
    </div>`;
  }).join("");

  // Click handlers
  items.forEach(ev => {
    el.querySelector(`[data-evid="${ev.id}"]`)?.addEventListener("click", () => showHomeEventPopup(ev));
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
    const rankingUrl = `${repoRoot()}pages/ranking/ranking.html`;
    el.innerHTML = items.map((u, i) => `
      <a href="${rankingUrl}" style="display:flex;align-items:center;gap:8px;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,.05);text-decoration:none;transition:background .12s;border-radius:6px;" onmouseenter="this.style.background='rgba(255,255,255,.04)'" onmouseleave="this.style.background=''">
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
