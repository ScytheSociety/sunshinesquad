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
    .slice(0, 4);
  if (!items.length) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.8rem;">Sin eventos próximos.</div>`; return; }
  const cfg = { activo:{ dot:"#22c55e" }, futuro:{ dot:"#a5b4fc" } };
  el.innerHTML = items.map(ev => {
    const c    = cfg[ev.estado] || cfg.futuro;
    const hora = ev.inicio.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
    const fLbl = ev.inicio.toLocaleDateString("es", { weekday:"short", day:"numeric", month:"short" });
    return `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:.6rem;">
      <div style="width:7px;height:7px;border-radius:50%;background:${c.dot};margin-top:.35rem;flex-shrink:0;"></div>
      <div>
        <div style="font-size:.8rem;font-weight:700;color:#fff;">${ev.juego}</div>
        <div style="font-size:.72rem;color:rgba(255,255,255,.5);">${ev.evento}</div>
        <div style="font-size:.66rem;color:rgba(255,255,255,.3);">${fLbl} · ${hora}</div>
      </div>
    </div>`;
  }).join("");
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
    const items = await fetch(`${API}/birthdays`).then(r => r.json());
    if (!items.length) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.8rem;">Sin cumpleaños esta semana.</div>`; return; }
    el.innerHTML = items.map(b => {
      const label = b.dias_faltantes === 0 ? "🎉 ¡Hoy!" : `en ${b.dias_faltantes}d`;
      const color = b.dias_faltantes === 0 ? "#fde047" : "rgba(255,255,255,.5)";
      return `<div class="d-flex align-items-center gap-2 mb-2">
        ${b.avatar_url ? `<img src="${b.avatar_url}" width="28" height="28" style="border-radius:50%;object-fit:cover;" loading="lazy">` : `<div style="width:28px;height:28px;border-radius:50%;background:rgba(99,102,241,.3);display:flex;align-items:center;justify-content:center;font-size:.7rem;">🎂</div>`}
        <div style="flex:1;min-width:0;">
          <div style="font-size:.82rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.username}</div>
          <div style="font-size:.7rem;color:${color};">${label}</div>
        </div>
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
    el.innerHTML = items.map((u, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,.05);">
        <div style="font-size:.95rem;min-width:22px;text-align:center;">${MEDALLAS[i]}</div>
        ${u.avatar_url ? `<img src="${u.avatar_url}" width="28" height="28" style="border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.1);" loading="lazy">` : `<div style="width:28px;height:28px;border-radius:50%;background:rgba(99,102,241,.2);"></div>`}
        <div style="flex:1;min-width:0;font-weight:700;font-size:.8rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.username}</div>
        <div style="font-size:.85rem;font-weight:900;color:#fbbf24;">${u.puntos_totales?.toLocaleString() ?? 0}</div>
      </div>`).join("");
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

// ── Blog carousel ────────────────────────────────────────────────────
async function renderBlogPosts() {
  const section = document.getElementById("blog-section");
  if (!section) return;
  try {
    const data  = await fetch(`${API}/blog?page=1`).then(r => r.json());
    const posts = (data.posts || []).slice(0, 10);
    if (!posts.length) return;
    section.style.display = "block";
    buildCarousel({
      prevId: "blog-carousel-prev", nextId: "blog-carousel-next",
      trackId: "blog-carousel-track", dotsId: "blog-carousel-dots",
      viewportSelector: ".blog-carousel-viewport",
      items: posts,
      getVisible: getVisibleDefault,
      renderCard: p => {
        const date = new Date(p.created_at).toLocaleDateString("es", { day:"numeric", month:"short", year:"numeric" });
        return `
          <a class="carousel-card" href="pages/blog/post.html?slug=${p.slug}" style="flex-shrink:0;text-decoration:none;">
            ${p.portada_url
              ? `<img src="${p.portada_url}" alt="${p.titulo}" class="carousel-cover" loading="lazy">`
              : `<div class="carousel-cover-placeholder">📝</div>`
            }
            <div class="carousel-info">
              <div class="carousel-name">${p.titulo}</div>
              <div class="carousel-server">${p.autor_nombre} · ${date}</div>
              ${p.juego ? `<div style="margin-top:.3rem;"><span style="font-size:.6rem;font-weight:700;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:#a5b4fc;border-radius:999px;padding:.1rem .4rem;">${p.juego}</span></div>` : ""}
            </div>
          </a>`;
      }
    });
  } catch {}
}

// ── Proyectos carousel (sss + serie) ─────────────────────────────────
function renderProyectos(games, rootUrl) {
  const section   = document.getElementById("proyectos-section");
  const proyectos = games.filter(g => g.sss || g.serie);
  if (!proyectos.length || !section) return;
  section.style.display = "block";
  buildCarousel({
    prevId: "proy-carousel-prev", nextId: "proy-carousel-next",
    trackId: "proy-carousel-track", dotsId: "proy-carousel-dots",
    viewportSelector: ".proy-carousel-viewport",
    items: proyectos,
    getVisible: getVisibleDefault,
    renderCard: g => {
      const gameUrl = rootUrl + g.url.replace(/^\//, "");
      const imgSrc  = g.imagen ? rootUrl + g.imagen : null;
      const badge   = g.sss
        ? `<span style="font-size:.6rem;font-weight:700;background:rgba(20,184,166,.15);border:1px solid rgba(20,184,166,.35);color:#5eead4;border-radius:999px;padding:.1rem .4rem;">SSS</span>`
        : `<span style="font-size:.6rem;font-weight:700;background:rgba(168,85,247,.15);border:1px solid rgba(168,85,247,.35);color:#d8b4fe;border-radius:999px;padding:.1rem .4rem;">SERIE</span>`;
      return `
        <a class="carousel-card" href="${gameUrl}" style="flex-shrink:0;">
          ${imgSrc ? `<img src="${imgSrc}" alt="${g.nombre}" class="carousel-cover" loading="lazy">` : `<div class="carousel-cover-placeholder">🎮</div>`}
          <div class="carousel-info">
            <div class="carousel-name">${g.nombre}</div>
            <div class="carousel-server">${g.servidor || ""}</div>
            <div style="margin-top:.3rem;">${badge}</div>
          </div>
        </a>`;
    }
  });
}

// ── Clanes en Juegos carousel ────────────────────────────────────────
function renderCarousel(games, rootUrl) {
  buildCarousel({
    prevId: "carousel-prev", nextId: "carousel-next",
    trackId: "carousel-track", dotsId: "carousel-dots",
    viewportSelector: ".clanes-carousel-viewport",
    items: games,
    getVisible: getVisibleDefault,
    renderCard: g => {
      const gameUrl = rootUrl + g.url.replace(/^\//, "");
      const imgSrc  = g.imagen ? rootUrl + g.imagen : null;
      const badges  = [
        g.guild ? `<span style="font-size:.6rem;font-weight:700;background:rgba(234,179,8,.15);border:1px solid rgba(234,179,8,.35);color:#fde047;border-radius:999px;padding:.1rem .4rem;">GUILD</span>` : "",
        g.serie ? `<span style="font-size:.6rem;font-weight:700;background:rgba(168,85,247,.15);border:1px solid rgba(168,85,247,.35);color:#d8b4fe;border-radius:999px;padding:.1rem .4rem;">SERIE</span>` : "",
        g.sss   ? `<span style="font-size:.6rem;font-weight:700;background:rgba(20,184,166,.15);border:1px solid rgba(20,184,166,.35);color:#5eead4;border-radius:999px;padding:.1rem .4rem;">SSS</span>` : "",
      ].join("");
      return `
        <a class="carousel-card" href="${gameUrl}" style="flex-shrink:0;">
          ${imgSrc ? `<img src="${imgSrc}" alt="${g.nombre}" class="carousel-cover" loading="lazy">` : `<div class="carousel-cover-placeholder">🎮</div>`}
          <div class="carousel-info">
            <div class="carousel-name">${g.nombre}</div>
            <div class="carousel-server">${g.servidor || ""}</div>
            ${badges ? `<div style="margin-top:.3rem;display:flex;gap:3px;flex-wrap:wrap;">${badges}</div>` : ""}
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
    const sched = await loadJson("data/schedule.json");
    renderEventos(sched.eventos);
  } catch(e) { console.error("schedule.json:", e); }

  try {
    const data    = await loadJson("data/games.json");
    const rootUrl = repoRoot();
    renderCarousel(data.juegos.filter(g => g.guild), rootUrl);
    renderProyectos(data.juegos, rootUrl);
  } catch(e) { console.error("games.json:", e); }

  renderMVP();
  renderBirthdays();
  renderBlogPosts();
  renderRanking();
});
