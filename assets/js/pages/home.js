import { loadJson, repoRoot } from "../app.js";

const API = "https://sunshinesquad.es/api";

// ── Twitch ──────────────────────────────────────────────────────────
function buildPlayer(ch) { return `https://player.twitch.tv/?channel=${ch}&parent=${window.location.hostname}&autoplay=true&muted=false`; }
function buildChat(ch)   { return `https://www.twitch.tv/embed/${ch}/chat?parent=${window.location.hostname}`; }

let activeChannel = null;

function loadStream(ch) {
  document.getElementById("stream-iframe").src = buildPlayer(ch);
  document.getElementById("chat-iframe").src   = buildChat(ch);
  matchChatHeight();
  activeChannel = ch;
}

function matchChatHeight() {
  const p = document.getElementById("player-wrap");
  const c = document.getElementById("chat-wrap");
  if (!p || !c) return;
  const h = p.offsetWidth * 9 / 16;
  c.style.height = h + "px";
}
window.addEventListener("resize", matchChatHeight);

function renderChannels(channels) {
  const list = document.getElementById("channel-list");
  if (!list || !channels.length) return;
  channels.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.className   = "btn-ss";
    btn.textContent = item.name;
    btn.style.cssText = "font-size:.78rem;padding:.3rem .65rem;display:block;width:100%;margin-bottom:6px;text-align:left;";
    btn.addEventListener("click", () => {
      list.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadStream(item.channel);
    });
    list.appendChild(btn);
    if (idx === 0) {
      btn.classList.add("active");
      loadStream(item.channel);
    }
  });
  matchChatHeight();
}

// ── Timezone helpers ────────────────────────────────────────────────
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
  if (!items.length) {
    el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.8rem;">Sin eventos próximos.</div>`;
    return;
  }
  const cfg = { activo: { dot:"#22c55e" }, futuro: { dot:"#a5b4fc" } };
  el.innerHTML = items.map(ev => {
    const c    = cfg[ev.estado] || cfg.futuro;
    const hora = ev.inicio.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
    const fLbl = ev.inicio.toLocaleDateString("es", { weekday:"short", day:"numeric", month:"short" });
    return `
      <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:.6rem;">
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
    const res = await fetch(`${API}/mvp/next`);
    const mvp = await res.json();
    if (!mvp || !mvp.respawn_at) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.8rem;">Sin MVPs próximamente.</div>`; return; }
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
    el.innerHTML = `
      <div class="d-flex align-items-center gap-2">
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
    const res   = await fetch(`${API}/birthdays`);
    const items = await res.json();
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

// ── Blog posts ──────────────────────────────────────────────────────
async function renderBlogPosts() {
  const section = document.getElementById("blog-section");
  const el      = document.getElementById("blog-posts-home");
  if (!section || !el) return;
  try {
    const res   = await fetch(`${API}/blog?page=1`);
    const data  = await res.json();
    const posts = (data.posts || []).slice(0, 5);
    if (!posts.length) return;
    section.style.display = "block";
    el.innerHTML = posts.map(p => `
      <a href="pages/blog/post.html?slug=${p.slug}" style="display:flex;gap:12px;align-items:flex-start;padding:.65rem .5rem;border-bottom:1px solid rgba(255,255,255,.06);text-decoration:none;border-radius:8px;transition:background .12s;"
         onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background='transparent'">
        ${p.juego ? `<span style="font-size:.62rem;font-weight:700;letter-spacing:.4px;text-transform:uppercase;background:rgba(99,102,241,.18);border:1px solid rgba(99,102,241,.3);color:#a5b4fc;border-radius:999px;padding:.12rem .5rem;white-space:nowrap;flex-shrink:0;margin-top:.15rem;">${p.juego}</span>` : ""}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:.88rem;color:#fff;line-height:1.3;margin-bottom:.15rem;">${p.titulo}</div>
          ${p.resumen ? `<div style="font-size:.76rem;color:rgba(255,255,255,.45);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.resumen}</div>` : ""}
          <div style="font-size:.68rem;color:rgba(255,255,255,.28);margin-top:.2rem;">${p.autor_nombre} · ${new Date(p.created_at).toLocaleDateString("es",{day:"numeric",month:"short",year:"numeric"})}</div>
        </div>
      </a>`).join("");
  } catch {}
}

// ── Ranking ─────────────────────────────────────────────────────────
const MEDALLAS = ["🥇","🥈","🥉","4️⃣","5️⃣"];
async function renderRanking() {
  const el = document.getElementById("ranking-content");
  if (!el) return;
  try {
    const res   = await fetch(`${API}/ranking?limit=5`);
    const items = await res.json();
    if (!items.length) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.8rem;">Sin datos.</div>`; return; }
    el.innerHTML = items.map((u, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,.05);">
        <div style="font-size:.95rem;min-width:22px;text-align:center;">${MEDALLAS[i]}</div>
        ${u.avatar_url ? `<img src="${u.avatar_url}" width="28" height="28" style="border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.1);" loading="lazy">` : `<div style="width:28px;height:28px;border-radius:50%;background:rgba(99,102,241,.2);"></div>`}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:.8rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.username}</div>
        </div>
        <div style="font-size:.85rem;font-weight:900;color:#fbbf24;">${u.puntos_totales?.toLocaleString() ?? 0}</div>
      </div>`).join("");
  } catch { el.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:.8rem;">No disponible.</div>`; }
}

// ── Proyectos (sss + serie) ──────────────────────────────────────────
function renderProyectos(games, rootUrl) {
  const el = document.getElementById("proyectos-content");
  if (!el) return;
  const proyectos = games.filter(g => g.sss || g.serie);
  if (!proyectos.length) return; // keep "Próximamente" placeholder
  el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:14px;">` +
    proyectos.map(g => {
      const gameUrl = rootUrl + g.url.replace(/^\//, "");
      const imgSrc  = g.imagen ? rootUrl + g.imagen : null;
      const badge   = g.sss
        ? `<span style="font-size:.6rem;font-weight:700;background:rgba(20,184,166,.15);border:1px solid rgba(20,184,166,.35);color:#5eead4;border-radius:999px;padding:.1rem .4rem;">SSS</span>`
        : g.serie
        ? `<span style="font-size:.6rem;font-weight:700;background:rgba(168,85,247,.15);border:1px solid rgba(168,85,247,.35);color:#d8b4fe;border-radius:999px;padding:.1rem .4rem;">SERIE</span>`
        : "";
      return `
        <a href="${gameUrl}" style="width:150px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.03);text-decoration:none;display:block;transition:border-color .15s,transform .15s;"
           onmouseover="this.style.borderColor='rgba(99,102,241,.45)';this.style.transform='translateY(-3px)'"
           onmouseout="this.style.borderColor='rgba(255,255,255,.10)';this.style.transform='none'">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="${g.nombre}" style="width:100%;aspect-ratio:4/5;object-fit:cover;display:block;" loading="lazy">`
            : `<div style="width:100%;aspect-ratio:4/5;background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;font-size:2rem;">🎮</div>`
          }
          <div style="padding:.6rem .7rem .75rem;">
            <div style="font-weight:700;font-size:.85rem;color:#fff;line-height:1.2;margin-bottom:.25rem;">${g.nombre}</div>
            <div style="font-size:.68rem;color:rgba(255,255,255,.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:.3rem;">${g.servidor || ""}</div>
            ${badge ? `<div>${badge}</div>` : ""}
          </div>
        </a>`;
    }).join("") + `</div>`;
}

// ── Games Carousel (guild games, 5 visible) ──────────────────────────
let carouselIndex = 0;
let carouselGames = [];
let carouselTimer = null;

function getVisible() {
  const w = window.innerWidth;
  if (w < 576) return 1;
  if (w < 768) return 2;
  if (w < 992) return 3;
  return 5;
}

function getCardWidth() {
  const viewport = document.querySelector(".carousel-viewport");
  if (!viewport) return 160;
  const visible = getVisible();
  const gap = 14;
  return Math.floor((viewport.offsetWidth - gap * (visible - 1)) / visible);
}

function updateCarousel() {
  const track = document.getElementById("carousel-track");
  if (!track || !carouselGames.length) return;

  const visible = getVisible();
  const cardW   = getCardWidth();
  const gap     = 14;

  // Update each card width dynamically
  track.querySelectorAll(".carousel-card").forEach(c => { c.style.width = cardW + "px"; });

  const max = Math.max(0, carouselGames.length - visible);
  carouselIndex = Math.max(0, Math.min(carouselIndex, max));
  track.style.transform = `translateX(-${carouselIndex * (cardW + gap)}px)`;

  document.querySelectorAll(".carousel-dot").forEach((d, i) => d.classList.toggle("active", i === carouselIndex));

  const prev = document.getElementById("carousel-prev");
  const next = document.getElementById("carousel-next");
  if (prev) prev.disabled = carouselIndex === 0;
  if (next) next.disabled = carouselIndex >= max;

  // Hide arrows/dots if all cards fit
  const arrowPrev = document.getElementById("carousel-prev");
  const arrowNext = document.getElementById("carousel-next");
  const dots = document.getElementById("carousel-dots");
  const noScroll = carouselGames.length <= visible;
  if (arrowPrev) arrowPrev.style.visibility = noScroll ? "hidden" : "visible";
  if (arrowNext) arrowNext.style.visibility = noScroll ? "hidden" : "visible";
  if (dots) dots.style.display = noScroll ? "none" : "flex";
}

function carouselNext() {
  const max = Math.max(0, carouselGames.length - getVisible());
  carouselIndex = carouselIndex >= max ? 0 : carouselIndex + 1;
  updateCarousel();
}
function carouselPrev() {
  const max = Math.max(0, carouselGames.length - getVisible());
  carouselIndex = carouselIndex <= 0 ? max : carouselIndex - 1;
  updateCarousel();
}
function startCarouselTimer() {
  if (carouselTimer) clearInterval(carouselTimer);
  carouselTimer = setInterval(carouselNext, 3500);
}

function renderCarousel(games, rootUrl) {
  carouselGames = games;
  carouselIndex = 0;
  const track = document.getElementById("carousel-track");
  const dots  = document.getElementById("carousel-dots");
  if (!track) return;

  track.innerHTML = games.map(g => {
    const gameUrl = rootUrl + g.url.replace(/^\//, "");
    const badges  = [
      g.guild ? `<span style="font-size:.6rem;font-weight:700;background:rgba(234,179,8,.15);border:1px solid rgba(234,179,8,.35);color:#fde047;border-radius:999px;padding:.1rem .4rem;">GUILD</span>` : "",
      g.serie ? `<span style="font-size:.6rem;font-weight:700;background:rgba(168,85,247,.15);border:1px solid rgba(168,85,247,.35);color:#d8b4fe;border-radius:999px;padding:.1rem .4rem;">SERIE</span>` : "",
      g.sss   ? `<span style="font-size:.6rem;font-weight:700;background:rgba(20,184,166,.15);border:1px solid rgba(20,184,166,.35);color:#5eead4;border-radius:999px;padding:.1rem .4rem;">SSS</span>` : "",
    ].join("");
    const imgSrc = g.imagen ? rootUrl + g.imagen : null;
    return `
      <a class="carousel-card" href="${gameUrl}" style="flex-shrink:0;">
        ${imgSrc ? `<img src="${imgSrc}" alt="${g.nombre}" class="carousel-cover" loading="lazy">` : `<div class="carousel-cover-placeholder">🎮</div>`}
        <div class="carousel-info">
          <div class="carousel-name">${g.nombre}</div>
          <div class="carousel-server">${g.servidor || ""}</div>
          ${badges ? `<div style="margin-top:.3rem;display:flex;gap:3px;flex-wrap:wrap;">${badges}</div>` : ""}
        </div>
      </a>`;
  }).join("");

  const visible   = getVisible();
  const dotsCount = Math.max(1, games.length - visible + 1);
  if (dots) {
    dots.innerHTML = Array.from({ length: dotsCount }, (_, i) =>
      `<button class="carousel-dot${i === 0 ? " active" : ""}"></button>`
    ).join("");
    dots.querySelectorAll(".carousel-dot").forEach((d, i) => {
      d.addEventListener("click", () => { carouselIndex = i; updateCarousel(); startCarouselTimer(); });
    });
  }

  document.getElementById("carousel-prev")?.addEventListener("click", () => { carouselPrev(); startCarouselTimer(); });
  document.getElementById("carousel-next")?.addEventListener("click", () => { carouselNext(); startCarouselTimer(); });
  window.addEventListener("resize", updateCarousel);

  // Initial sizing after layout
  requestAnimationFrame(() => {
    updateCarousel();
    if (games.length > getVisible()) startCarouselTimer();
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
