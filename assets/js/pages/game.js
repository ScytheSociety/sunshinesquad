// Página de juego genérica — carga data/{game}.json según data-game del <body>
import { loadJson, repoRoot } from "../app.js";

const GAME_KEY = document.body.dataset.game;
const ROOT     = repoRoot();
const API      = "https://sunshinesquad.es/api";

// ── Tabs ───────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
      btn.classList.add("active");
      const tab = document.getElementById("tab-" + btn.dataset.tab);
      if (tab) tab.style.display = "block";
    });
  });
}

// ── Tabla de configuración del servidor ───────────────────────────
function renderTabla(info) {
  const el = document.getElementById("servidor-tabla");
  if (!el || !info?.length) return;
  el.innerHTML = info.map(r => `
    <div class="ro-tabla-fila">
      <span class="ro-tabla-fila-label">${r.label}</span>
      <span class="ro-tabla-fila-valor">${r.valor}</span>
    </div>`).join("");
}

// ── Lightbox ────────────────────────────────────────────────────────
function openLightbox(src, caption) {
  const overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.innerHTML = `
    <button class="lightbox-close">✕</button>
    <img src="${src}" alt="${caption || ""}" class="lightbox-img">
    ${caption ? `<div class="lightbox-caption">${caption}</div>` : ""}
  `;
  overlay.addEventListener("click", e => {
    if (e.target === overlay || e.target.classList.contains("lightbox-close")) overlay.remove();
  });
  document.body.appendChild(overlay);
}

// ── Slider genérico con botones laterales ──────────────────────────
function buildSlider({ stripId, dotsId, prevId, nextId, visible, gap, dotClass }) {
  const strip   = document.getElementById(stripId);
  const dotsEl  = document.getElementById(dotsId);
  const btnPrev = document.getElementById(prevId);
  const btnNext = document.getElementById(nextId);
  if (!strip) return null;

  let current = 0;

  function getVis() {
    const w = window.innerWidth;
    if (w < 480)  return 1;
    if (w < 768)  return Math.min(2, visible);
    if (w < 1024) return Math.min(3, visible);
    return visible;
  }

  function setWidths() {
    const vis = getVis();
    const w   = (strip.parentElement.offsetWidth - gap * (vis - 1)) / vis;
    [...strip.children].forEach(el => { el.style.width = w + "px"; });
    return { w, vis };
  }

  function updateDots() {
    if (!dotsEl) return;
    [...dotsEl.children].forEach((d, i) => d.classList.toggle("active", i === current));
  }

  function goTo(idx) {
    const { w, vis } = setWidths();
    const max = Math.max(0, strip.children.length - vis);
    current = Math.max(0, Math.min(idx, max));
    strip.style.transform = `translateX(-${current * (w + gap)}px)`;
    updateDots();
    if (btnPrev) btnPrev.disabled = current === 0;
    if (btnNext) btnNext.disabled = current >= max;
  }

  if (btnPrev) btnPrev.addEventListener("click", () => goTo(current - 1));
  if (btnNext) btnNext.addEventListener("click", () => goTo(current + 1));
  window.addEventListener("resize", () => goTo(current));

  function addDot(idx) {
    if (!dotsEl) return;
    const dot = document.createElement("div");
    dot.className = dotClass + (idx === 0 ? " active" : "");
    dot.addEventListener("click", () => goTo(idx));
    dotsEl.appendChild(dot);
  }

  return { addDot, init: () => setTimeout(() => goTo(0), 60) };
}

// ── Galería de imágenes 16:9 con lightbox ─────────────────────────
function renderGaleria(items) {
  const slider = buildSlider({
    stripId: "galeria-strip", dotsId: "galeria-dots",
    prevId:  "galeria-prev",  nextId: "galeria-next",
    visible: 5, gap: 10, dotClass: "galeria-dot"
  });
  if (!slider || !items?.length) return;

  const strip = document.getElementById("galeria-strip");
  items.forEach((item, idx) => {
    const imgSrc = item.imagen.startsWith("http") ? item.imagen : ROOT + item.imagen;
    const div = document.createElement("div");
    div.className = "galeria-item";
    div.style.cursor = "pointer";
    div.innerHTML = `
      <img src="${imgSrc}" alt="${item.titulo || ""}" loading="lazy" onerror="this.style.minHeight='80px'">
      <div class="galeria-item-titulo">${item.titulo || ""}</div>
    `;
    div.addEventListener("click", () => openLightbox(imgSrc, item.titulo));
    strip.appendChild(div);
    slider.addDot(idx);
  });
  slider.init();
}

// ── Galería de videos 16:9 ─────────────────────────────────────────
function renderVideos(items) {
  const slider = buildSlider({
    stripId: "videos-strip", dotsId: "videos-dots",
    prevId:  "videos-prev",  nextId: "videos-next",
    visible: 2, gap: 10, dotClass: "videos-dot"
  });
  if (!slider || !items?.length) return;

  const strip = document.getElementById("videos-strip");
  items.forEach((v, idx) => {
    const ytMatch  = v.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
    const embedUrl = ytMatch ? `https://www.youtube-nocookie.com/embed/${ytMatch[1]}` : v.url;
    const div = document.createElement("div");
    div.className = "video-item";
    div.innerHTML = `
      <div class="video-item-ratio">
        <iframe src="${embedUrl}" allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
        </iframe>
      </div>
      <div class="video-titulo">${v.titulo}</div>
    `;
    strip.appendChild(div);
    slider.addDot(idx);
  });
  slider.init();
}

// ── Grid de guías / builds ─────────────────────────────────────────
function renderGrid(items, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items?.length) {
    el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;padding:1rem 0;">Próximamente.</div>`;
    return;
  }
  el.innerHTML = items.map(item => `
    <a href="${ROOT}${item.url}" class="ro-card" style="text-decoration:none;">
      <img src="${ROOT}${item.imagen}" alt="${item.nombre}" onerror="this.style.display='none'" loading="lazy">
      <div class="ro-card-body">
        <div class="ro-card-title">${item.nombre}</div>
        <div class="ro-card-desc">${item.descripcion || ""}</div>
      </div>
    </a>`).join("");
}

// ── Clan ────────────────────────────────────────────────────────────
async function renderClan(gameKey) {
  const el = document.getElementById("clan-content");
  if (!el) return;
  el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;">Cargando...</div>`;
  try {
    const res = await fetch(`${API}/clan/${gameKey}`);
    if (!res.ok) throw new Error();
    const miembros = await res.json();
    if (!miembros.length) {
      el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;">Sin miembros registrados aún.</div>`;
      return;
    }
    el.innerHTML = miembros.map((u, i) => `
      <div class="d-flex align-items-center gap-2 mb-2 p-2" style="border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);">
        <div style="font-size:.8rem;min-width:20px;text-align:center;color:rgba(255,255,255,.3);">#${i+1}</div>
        ${u.avatar_url ? `<img src="${u.avatar_url}" width="32" height="32" style="border-radius:50%;object-fit:cover;flex-shrink:0;" loading="lazy">` : `<div style="width:32px;height:32px;border-radius:50%;background:rgba(99,102,241,.2);flex-shrink:0;"></div>`}
        <div style="flex:1;min-width:0;">
          <div style="font-size:.88rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.username}</div>
          ${u.rank_name ? `<div style="font-size:.72rem;color:rgba(255,255,255,.4);">${u.rank_name}</div>` : ""}
        </div>
        ${u.puntos != null ? `<div style="font-size:.85rem;font-weight:700;color:#fbbf24;">${Number(u.puntos).toLocaleString()} pts</div>` : ""}
      </div>`).join("");
  } catch {
    el.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:.82rem;">Datos del clan no disponibles.</div>`;
  }
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!GAME_KEY) return;
  initTabs();

  try {
    const data = await loadJson(`data/${GAME_KEY}.json`);

    const descEl = document.getElementById("game-descripcion");
    if (descEl) descEl.textContent = data.descripcion || "";

    const srv = data.servidor;
    if (srv) {
      const logoEl = document.getElementById("servidor-logo");
      if (logoEl) { if (srv.logo) { logoEl.src = srv.logo; logoEl.style.display = ""; } else logoEl.style.display = "none"; }

      const descSrv = document.getElementById("servidor-descripcion");
      if (descSrv) descSrv.textContent = srv.descripcion || "";

      const btnDesc = document.getElementById("btn-descarga");
      if (btnDesc) { if (srv.descarga) { btnDesc.href = srv.descarga; btnDesc.style.display = "inline-flex"; } else btnDesc.style.display = "none"; }

      const btnDisc = document.getElementById("btn-discord");
      if (btnDisc) { if (srv.discord) { btnDisc.href = srv.discord; btnDisc.style.display = "inline-flex"; } else btnDisc.style.display = "none"; }

      const btnWeb = document.getElementById("btn-web");
      if (btnWeb) { if (srv.web) { btnWeb.href = srv.web; btnWeb.style.display = "inline-flex"; } else btnWeb.style.display = "none"; }

      const btnWiki = document.getElementById("btn-wiki");
      if (btnWiki) { if (srv.wiki) { btnWiki.href = srv.wiki; btnWiki.style.display = "inline-flex"; } else btnWiki.style.display = "none"; }

      renderTabla(srv.info);
    }

    if (data.galeria?.length) renderGaleria(data.galeria);
    if (data.videos?.length)  renderVideos(data.videos);
    renderGrid(data.guias,  "guias-grid");
    renderGrid(data.builds, "builds-grid");
    renderClan(GAME_KEY);

  } catch(e) { console.error(`game.js [${GAME_KEY}]:`, e); }
});
