import { loadJson, repoRoot } from "../app.js";

const API = "https://sunshinesquad.es/api";

// ── Twitch embeds ───────────────────────────────────────────────────
function buildPlayer(ch) { return `https://player.twitch.tv/?channel=${ch}&parent=${window.location.hostname}&autoplay=true&muted=false`; }
function buildChat(ch)   { return `https://www.twitch.tv/embed/${ch}/chat?parent=${window.location.hostname}`; }
function setStream(ch) {
  document.getElementById("stream-iframe").src = buildPlayer(ch);
  document.getElementById("chat-iframe").src   = buildChat(ch);
}
function matchChatHeight() {
  const p = document.getElementById("player-wrap");
  const c = document.getElementById("chat-wrap");
  if (!p || !c) return;
  const h = p.offsetWidth * 9 / 16;
  c.style.height = h + "px";
  document.getElementById("chat-iframe").style.height = h + "px";
}
window.addEventListener("load",   matchChatHeight);
window.addEventListener("resize", matchChatHeight);

function renderChannels(channels) {
  const list = document.getElementById("channel-list");
  if (!list) return;
  channels.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.className   = "btn-ss";
    btn.textContent = item.name;
    btn.style.cssText = "display:block;width:100%;margin-bottom:6px;text-align:left;";
    btn.addEventListener("click", () => {
      list.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      setStream(item.channel);
    });
    list.appendChild(btn);
    if (idx === 0) { btn.classList.add("active"); setStream(item.channel); }
  });
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

// ── Próximos Eventos (columna) ──────────────────────────────────────
function renderEventos(eventos) {
  const el = document.getElementById("eventos-content");
  if (!el) return;
  const ahora   = new Date();
  const limite  = new Date(ahora.getTime() + 7 * 24 * 3600000);
  const items = eventos
    .map(ev => ({ ...ev, inicio: toLocal(ev.fecha, ev.hora, ev.timezone || "America/Lima") }))
    .map(ev => ({ ...ev, estado: getEstado(ev.inicio, ev.duracion) }))
    .filter(ev => ev.estado !== "pasado" && ev.inicio <= limite)
    .sort((a, b) => a.inicio - b.inicio)
    .slice(0, 4);
  if (!items.length) {
    el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.82rem;">Sin eventos próximos.</div>`;
    return;
  }
  const cfg = {
    activo: { dot:"#22c55e", label:"En curso" },
    futuro: { dot:"#a5b4fc", label:"Próximo"  },
  };
  el.innerHTML = items.map(ev => {
    const c    = cfg[ev.estado] || cfg.futuro;
    const hora = ev.inicio.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
    const fLbl = ev.inicio.toLocaleDateString("es", { weekday:"short", day:"numeric", month:"short" });
    return `
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:.65rem;">
        <div style="width:8px;height:8px;border-radius:50%;background:${c.dot};margin-top:.35rem;flex-shrink:0;"></div>
        <div style="min-width:0;">
          <div style="font-size:.82rem;font-weight:700;color:#fff;line-height:1.2;">${ev.juego}</div>
          <div style="font-size:.75rem;color:rgba(255,255,255,.5);margin-bottom:.1rem;">${ev.evento}</div>
          <div style="font-size:.68rem;color:rgba(255,255,255,.3);">${fLbl} · ${hora}</div>
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
    if (!mvp || !mvp.respawn_at) {
      el.innerHTML = `<div style="color:rgba(255,255,255,.35);font-size:.82rem;">Sin MVPs próximamente.</div>`;
      return;
    }
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
      <div class="d-flex align-items-center gap-3">
        ${mvp.image_url ? `<img src="${mvp.image_url}" alt="${mvp.boss_name}" style="width:56px;height:56px;object-fit:contain;border-radius:10px;background:rgba(255,255,255,.05);">` : ""}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:.95rem;color:#fff;margin-bottom:.15rem;">${mvp.boss_name}</div>
          <div style="font-size:.75rem;color:rgba(255,255,255,.4);margin-bottom:.4rem;">📍 ${mvp.map || "Desconocido"}</div>
          <div style="font-size:.7rem;color:rgba(255,255,255,.3);">Spawn en</div>
          <div id="mvp-countdown" style="font-size:1.3rem;font-weight:900;font-variant-numeric:tabular-nums;color:#fbbf24;">${fmtCountdown(diff)}</div>
        </div>
      </div>`;
  } catch {
    el.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:.82rem;">MVP Tracker no disponible.</div>`;
  }
}

// ── Cumpleaños ──────────────────────────────────────────────────────
async function renderBirthdays() {
  const el = document.getElementById("birthday-content");
  if (!el) return;
  try {
    const res   = await fetch(`${API}/birthdays`);
    const items = await res.json();
    if (!items.length) {
      el.innerHTML = `<div style="color:rgba(255,255,255,.35);font-size:.82rem;">Sin cumpleaños esta semana.</div>`;
      return;
    }
    el.innerHTML = items.map(b => {
      const label = b.dias_faltantes === 0 ? "🎉 ¡Hoy!" : `en ${b.dias_faltantes} día${b.dias_faltantes !== 1 ? "s" : ""}`;
      const color = b.dias_faltantes === 0 ? "#fde047" : "rgba(255,255,255,.55)";
      return `
        <div class="d-flex align-items-center gap-2 mb-2">
          ${b.avatar_url ? `<img src="${b.avatar_url}" alt="${b.username}" width="30" height="30" style="border-radius:50%;object-fit:cover;">` : `<div style="width:30px;height:30px;border-radius:50%;background:rgba(99,102,241,.3);display:flex;align-items:center;justify-content:center;font-size:.75rem;">🎂</div>`}
          <div style="flex:1;min-width:0;">
            <div style="font-size:.83rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.username}</div>
            <div style="font-size:.7rem;color:${color};">${b.birthday} · ${label}</div>
          </div>
        </div>`;
    }).join("");
  } catch {
    el.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:.82rem;">Cumpleaños no disponible.</div>`;
  }
}

// ── Blog posts (últimos 5) ──────────────────────────────────────────
async function renderBlogPosts() {
  const section = document.getElementById("blog-section");
  const el      = document.getElementById("blog-posts-home");
  if (!section || !el) return;
  try {
    const res  = await fetch(`${API}/blog?page=1`);
    const data = await res.json();
    const posts = (data.posts || []).slice(0, 5);
    if (!posts.length) return;
    section.style.display = "block";
    el.innerHTML = posts.map(p => `
      <a class="home-blog-item" href="pages/blog/post.html?slug=${p.slug}" style="display:flex;gap:14px;align-items:flex-start;padding:.7rem .5rem;border-bottom:1px solid rgba(255,255,255,.06);text-decoration:none;border-radius:8px;transition:background .12s;"
         onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background='transparent'">
        ${p.juego ? `<span class="home-blog-tag">${p.juego}</span>` : ""}
        <div style="flex:1;min-width:0;">
          <div class="home-blog-title">${p.titulo}</div>
          ${p.resumen ? `<div class="home-blog-summary">${p.resumen}</div>` : ""}
          <div class="home-blog-meta">${p.autor_nombre} · ${new Date(p.created_at).toLocaleDateString("es",{day:"numeric",month:"short",year:"numeric"})}</div>
        </div>
      </a>`).join("");
  } catch { /* blog no disponible, sección oculta */ }
}

// ── Ranking ─────────────────────────────────────────────────────────
const MEDALLAS = ["🥇","🥈","🥉","4️⃣","5️⃣"];
async function renderRanking() {
  const el = document.getElementById("ranking-content");
  if (!el) return;
  try {
    const res   = await fetch(`${API}/ranking?limit=5`);
    const items = await res.json();
    if (!items.length) {
      el.innerHTML = `<div style="color:rgba(255,255,255,.35);font-size:.85rem;">Sin datos de ranking.</div>`;
      return;
    }
    el.innerHTML = items.map((u, i) => `
      <div style="border-radius:10px;padding:.6rem .75rem;margin-bottom:.4rem;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);cursor:pointer;"
           onclick="this.querySelector('.rk-detail').style.display=this.querySelector('.rk-detail').style.display==='none'?'block':'none'">
        <div class="d-flex align-items-center gap-3">
          <div style="font-size:1.1rem;min-width:28px;text-align:center;">${MEDALLAS[i]}</div>
          ${u.avatar_url ? `<img src="${u.avatar_url}" alt="${u.username}" width="34" height="34" style="border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.1);">` : `<div style="width:34px;height:34px;border-radius:50%;background:rgba(99,102,241,.2);"></div>`}
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:.88rem;color:#fff;">${u.username}</div>
            <div style="font-size:.7rem;color:rgba(255,255,255,.4);">${u.logros?.length ? u.logros[0].name : "Sin logros aún"}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:.95rem;font-weight:900;color:#fbbf24;">${u.puntos_totales?.toLocaleString() ?? 0}</div>
            <div style="font-size:.68rem;color:rgba(255,255,255,.3);">pts</div>
          </div>
        </div>
        <div class="rk-detail" style="display:none;margin-top:.6rem;padding-top:.6rem;border-top:1px solid rgba(255,255,255,.07);">
          ${u.juegos?.map(j => `
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span style="font-size:.75rem;color:rgba(255,255,255,.5);">${j.game}</span>
              <span style="font-size:.75rem;color:#a5b4fc;font-weight:600;">${j.points?.toLocaleString()} pts${j.rank_name ? ` · ${j.rank_name}` : ""}</span>
            </div>`).join("") ?? ""}
        </div>
      </div>`).join("");
  } catch {
    el.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:.82rem;">Ranking no disponible.</div>`;
  }
}

// ── Games Carousel (guild:true) ─────────────────────────────────────
let carouselIndex    = 0;
let carouselGames    = [];
let carouselVisible  = 3;
let carouselTimer    = null;

function getVisible() {
  const w = window.innerWidth;
  if (w < 576) return 1;
  if (w < 992) return 2;
  return 3;
}

function buildCarouselCard(game, rootUrl) {
  const gameUrl = rootUrl + game.url.replace(/^\//, "");
  const badges  = [
    game.guild ? `<span class="carousel-badge carousel-badge-guild">GUILD</span>` : "",
    game.serie ? `<span class="carousel-badge carousel-badge-serie">SERIE</span>` : "",
  ].join("");
  const img = game.imagen
    ? `<img src="${rootUrl + game.imagen}" alt="${game.nombre}" class="carousel-cover" loading="lazy">`
    : `<div class="carousel-cover-placeholder">🎮</div>`;
  return `
    <a class="carousel-card" href="${gameUrl}">
      ${img}
      <div class="carousel-info">
        <div class="carousel-name">${game.nombre}</div>
        <div class="carousel-server">${game.servidor || ""}</div>
        ${badges ? `<div style="margin-top:.3rem;">${badges}</div>` : ""}
      </div>
    </a>`;
}

function updateCarousel() {
  const track = document.getElementById("carousel-track");
  if (!track || !carouselGames.length) return;
  carouselVisible = getVisible();
  const cardW  = 180 + 14; // width + gap
  track.style.transform = `translateX(-${carouselIndex * cardW}px)`;
  document.querySelectorAll(".carousel-dot").forEach((d, i) => {
    d.classList.toggle("active", i === carouselIndex);
  });
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
  if (!track || !dots) return;

  track.innerHTML = games.map(g => buildCarouselCard(g, rootUrl)).join("");

  const dotsCount = Math.max(1, games.length - getVisible() + 1);
  dots.innerHTML  = Array.from({ length: dotsCount }, (_, i) =>
    `<button class="carousel-dot${i === 0 ? " active" : ""}"></button>`
  ).join("");
  dots.querySelectorAll(".carousel-dot").forEach((d, i) => {
    d.addEventListener("click", () => { carouselIndex = i; updateCarousel(); });
  });

  document.getElementById("carousel-prev")?.addEventListener("click", () => { carouselPrev(); startCarouselTimer(); });
  document.getElementById("carousel-next")?.addEventListener("click", () => { carouselNext(); startCarouselTimer(); });

  window.addEventListener("resize", updateCarousel);
  updateCarousel();
  startCarouselTimer();
}

// ── Other games strip (guild:false) ────────────────────────────────
function renderOtrosJuegos(games, rootUrl) {
  const section = document.getElementById("otros-juegos-section");
  const strip   = document.getElementById("otros-juegos-strip");
  if (!section || !strip || !games.length) return;
  section.style.display = "block";
  strip.innerHTML = games.map(g => {
    const gameUrl = rootUrl + g.url.replace(/^\//, "");
    const img = g.imagen
      ? `<img src="${rootUrl + g.imagen}" alt="${g.nombre}" class="game-cover" loading="lazy">`
      : `<div class="game-cover-placeholder">🎮</div>`;
    return `
      <a class="game-card" href="${gameUrl}">
        ${img}
        <div class="game-name">${g.nombre}</div>
      </a>`;
  }).join("");
}

// ── Init ────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Streams
  try {
    const streams = await loadJson("data/streams.json");
    renderChannels(streams.channels);
    setTimeout(matchChatHeight, 100);
  } catch(e) { console.error("streams.json:", e); }

  // Eventos
  try {
    const sched = await loadJson("data/schedule.json");
    renderEventos(sched.eventos);
  } catch(e) { console.error("schedule.json:", e); }

  // Games
  try {
    const data    = await loadJson("data/games.json");
    const rootUrl = repoRoot();
    const guild   = data.juegos.filter(g => g.guild);
    const otros   = data.juegos.filter(g => !g.guild);
    renderCarousel(guild, rootUrl);
    renderOtrosJuegos(otros, rootUrl);
  } catch(e) { console.error("games.json:", e); }

  // API widgets (no bloquean si fallan)
  renderMVP();
  renderBirthdays();
  renderBlogPosts();
  renderRanking();
});
