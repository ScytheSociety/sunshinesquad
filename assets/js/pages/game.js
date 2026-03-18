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

// ── Galería de imágenes 16:9 con lightbox (sin dots, min 5 slots) ──
function renderGaleria(rawItems) {
  const SLOTS = 5;
  // Rellenar hasta 5 con placeholders
  const items = [...(rawItems || [])];
  while (items.length < SLOTS) items.push({ imagen: null, titulo: "" });

  const slider = buildSlider({
    stripId: "galeria-strip", dotsId: null,
    prevId:  "galeria-prev",  nextId: "galeria-next",
    visible: SLOTS, gap: 10, dotClass: ""
  });
  if (!slider) return;

  const strip = document.getElementById("galeria-strip");
  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "galeria-item";
    if (item.imagen) {
      const imgSrc = item.imagen.startsWith("http") ? item.imagen : ROOT + item.imagen;
      div.style.cursor = "pointer";
      div.innerHTML = `
        <img src="${imgSrc}" alt="${item.titulo || ""}" loading="lazy">
        <div class="galeria-item-titulo">${item.titulo || ""}</div>`;
      div.addEventListener("click", () => openLightbox(imgSrc, item.titulo));
    } else {
      div.classList.add("galeria-item-empty");
      div.innerHTML = `<div class="galeria-empty-icon">📷</div>`;
    }
    strip.appendChild(div);
  });
  slider.init();
}

// ── Galería de videos 16:9 (sin dots, min 5 slots) ─────────────────
function renderVideos(rawItems) {
  const SLOTS = 5;
  const items = [...(rawItems || [])];
  while (items.length < SLOTS) items.push({ url: null, titulo: "" });

  const slider = buildSlider({
    stripId: "videos-strip", dotsId: null,
    prevId:  "videos-prev",  nextId: "videos-next",
    visible: 2, gap: 10, dotClass: ""
  });
  if (!slider) return;

  const strip = document.getElementById("videos-strip");
  items.forEach(v => {
    const div = document.createElement("div");
    div.className = "video-item";
    if (v.url) {
      const ytMatch  = v.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
      const embedUrl = ytMatch ? `https://www.youtube-nocookie.com/embed/${ytMatch[1]}` : v.url;
      div.innerHTML = `
        <div class="video-item-ratio">
          <iframe src="${embedUrl}" allowfullscreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
          </iframe>
        </div>
        <div class="video-titulo">${v.titulo}</div>`;
    } else {
      div.classList.add("video-item-empty");
      div.innerHTML = `<div class="video-empty-icon">▶️</div>`;
    }
    strip.appendChild(div);
  });
  slider.init();
}

// ── Grid de guías / builds con búsqueda ───────────────────────────
function drawGridCards(items, el, q) {
  const filtered = q
    ? items.filter(item =>
        item.nombre?.toLowerCase().includes(q) ||
        item.descripcion?.toLowerCase().includes(q) ||
        item.autor?.toLowerCase().includes(q) ||
        item.tags?.some(t => t.toLowerCase().includes(q))
      )
    : items;

  if (!filtered.length) {
    el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;padding:1rem 0;">Sin resultados.</div>`;
    return;
  }

  el.innerHTML = filtered.map(item => {
    const imgSrc = item.imagen ? (item.imagen.startsWith("http") ? item.imagen : ROOT + item.imagen) : null;
    const href   = item.url   ? (item.url.startsWith("http")    ? item.url    : ROOT + item.url)    : "#";
    const tags   = item.tags?.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:.4rem;">${item.tags.map(t =>
          `<span style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.3px;
                        background:rgba(99,102,241,.18);color:#a5b4fc;border-radius:20px;padding:.1rem .45rem;">${t}</span>`
        ).join("")}</div>` : "";
    const autor = item.autor
      ? `<div style="font-size:.72rem;color:rgba(255,255,255,.35);margin-top:.3rem;">Por ${item.autor}</div>` : "";
    return `
      <a href="${href}" class="ro-card" style="text-decoration:none;">
        ${imgSrc ? `<img src="${imgSrc}" alt="${item.nombre}" onerror="this.style.display='none'" loading="lazy">` : ""}
        <div class="ro-card-body">
          ${tags}
          <div class="ro-card-title">${item.nombre}</div>
          <div class="ro-card-desc">${item.descripcion || ""}</div>
          ${autor}
        </div>
      </a>`;
  }).join("");
}

function renderGrid(items, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items?.length) {
    el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;padding:1rem 0;">Próximamente.</div>`;
    return;
  }

  // Add search input once
  const searchId = containerId + "-search";
  if (!document.getElementById(searchId)) {
    const inp = document.createElement("input");
    inp.id = searchId;
    inp.type = "search";
    inp.placeholder = "Buscar por título, tags o autor...";
    inp.style.cssText = "width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:.5rem 1rem;color:#fff;font-size:.83rem;outline:none;margin-bottom:.75rem;";
    el.parentElement.insertBefore(inp, el);
    inp.addEventListener("input", () => drawGridCards(items, el, inp.value.toLowerCase().trim()));
  }

  drawGridCards(items, el, "");
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

// ── Aplicar datos del servidor ─────────────────────────────────────
function applyServerData(srv) {
  if (!srv) return;
  const logoEl = document.getElementById("servidor-logo");
  const logoSrc = srv.logo_url || srv.logo || null;
  if (logoEl) { if (logoSrc) { logoEl.src = logoSrc; logoEl.style.display = ""; } else logoEl.style.display = "none"; }

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

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!GAME_KEY) return;
  initTabs();

  // Load static JSON (base data: descripcion, servidor, guias, builds)
  let staticData = {};
  try { staticData = await loadJson(`data/${GAME_KEY}.json`); } catch {}

  const descEl = document.getElementById("game-descripcion");
  if (descEl && staticData.descripcion) descEl.textContent = staticData.descripcion;

  // Load API media (gallery, videos, server config) — overrides JSON if present
  let apiMedia = null;
  try {
    const r = await fetch(`${API}/game-media/${GAME_KEY}`);
    if (r.ok) apiMedia = await r.json();
  } catch {}

  // Server data: API takes priority, falls back to JSON
  const hasApiServer = apiMedia?.servidor &&
    (apiMedia.servidor.logo_url || apiMedia.servidor.descripcion ||
     apiMedia.servidor.web      || apiMedia.servidor.wiki        ||
     apiMedia.servidor.descarga || apiMedia.servidor.discord     ||
     apiMedia.servidor.info?.length);
  applyServerData(hasApiServer ? apiMedia.servidor : staticData.servidor);

  // Gallery: API takes priority (if any rows exist), else JSON
  const galleryItems = apiMedia?.gallery?.length
    ? apiMedia.gallery.map(g => ({ imagen: g.url, titulo: g.titulo }))
    : (staticData.galeria || []);
  renderGaleria(galleryItems);

  // Videos: API takes priority (if any rows exist), else JSON
  const videoItems = apiMedia?.videos?.length
    ? apiMedia.videos.map(v => ({ url: v.url, titulo: v.titulo }))
    : (staticData.videos || []);
  renderVideos(videoItems);

  renderGrid(staticData.guias,  "guias-grid");
  renderGrid(staticData.builds, "builds-grid");
  renderClan(GAME_KEY);
});
