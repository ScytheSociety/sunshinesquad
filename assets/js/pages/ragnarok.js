import { loadJson, repoRoot } from "../app.js";

// ── Pestañas ───────────────────────────────────────────────
function initTabs() {
  const btns = document.querySelectorAll(".tab-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).style.display = "block";
    });
  });
}

// ── Servidor ───────────────────────────────────────────────
function renderServidor(s) {
  const logo = document.getElementById("servidor-logo");
  if (logo) logo.src = s.logo;

  const desc = document.getElementById("servidor-descripcion");
  if (desc) desc.textContent = s.descripcion;

  const btnWeb     = document.getElementById("btn-web");
  const btnWiki    = document.getElementById("btn-wiki");
  const btnDesc    = document.getElementById("btn-descarga");
  const btnDiscord = document.getElementById("btn-discord");

  if (btnWeb)  btnWeb.href  = s.web;
  if (btnWiki) btnWiki.href = s.wiki;

  if (btnDesc) {
    if (s.descarga) { btnDesc.href = s.descarga; btnDesc.style.display = "inline-flex"; }
    else btnDesc.style.display = "none";
  }
  if (btnDiscord) {
    if (s.discord) { btnDiscord.href = s.discord; btnDiscord.style.display = "inline-flex"; }
    else btnDiscord.style.display = "none";
  }

  const tabla = document.getElementById("servidor-tabla");
  if (tabla) {
    s.info.forEach(item => {
      const fila = document.createElement("div");
      fila.className = "ro-tabla-fila";
      fila.innerHTML = `
        <span class="ro-tabla-fila-label">${item.label}</span>
        <span class="ro-tabla-fila-valor">${item.valor}</span>
      `;
      tabla.appendChild(fila);
    });
  }
}

// ── Slider genérico con botones laterales ─────────────────
function buildSlider({ stripId, dotsId, prevId, nextId, visible, gap, dotClass }) {
  const strip   = document.getElementById(stripId);
  const dotsEl  = document.getElementById(dotsId);
  const btnPrev = document.getElementById(prevId);
  const btnNext = document.getElementById(nextId);
  if (!strip) return null;

  let current = 0;

  function getVisible() {
    const w = window.innerWidth;
    if (w < 480)  return 1;
    if (w < 768)  return Math.min(2, visible);
    if (w < 1024) return Math.min(3, visible);
    return visible;
  }

  function setWidths() {
    const vis        = getVisible();
    const containerW = strip.parentElement.offsetWidth;
    const w          = (containerW - gap * (vis - 1)) / vis;
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

  function init() { setTimeout(() => goTo(0), 60); }

  return { addDot, init };
}

// ── Galería imágenes 9:16 ─────────────────────────────────
function renderGaleria(items) {
  const slider = buildSlider({
    stripId: "galeria-strip", dotsId: "galeria-dots",
    prevId:  "galeria-prev",  nextId: "galeria-next",
    visible: 5, gap: 10, dotClass: "galeria-dot"
  });
  if (!slider) return;

  const strip = document.getElementById("galeria-strip");
  items.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "galeria-item";
    div.innerHTML = `
      <img src="${repoRoot() + item.imagen}" alt="${item.titulo}"
           onerror="this.style.minHeight='150px'">
      <div class="galeria-item-titulo">${item.titulo}</div>
    `;
    strip.appendChild(div);
    slider.addDot(idx);
  });
  slider.init();
}

// ── Galería videos 16:9 ───────────────────────────────────
function renderVideos(videos) {
  const slider = buildSlider({
    stripId: "videos-strip", dotsId: "videos-dots",
    prevId:  "videos-prev",  nextId: "videos-next",
    visible: 3, gap: 10, dotClass: "videos-dot"
  });
  if (!slider) return;

  const strip = document.getElementById("videos-strip");
  videos.forEach((v, idx) => {
    const div = document.createElement("div");
    div.className = "video-item";
    let embedUrl = v.url;
    const ytMatch = v.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
    if (ytMatch) embedUrl = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
    div.innerHTML = `
      <iframe src="${embedUrl}" allowfullscreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
      </iframe>
      <div class="video-titulo">${v.titulo}</div>
    `;
    strip.appendChild(div);
    slider.addDot(idx);
  });
  slider.init();
}

// ── Cards guías / builds ───────────────────────────────────
function renderCards(items, containerId) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  items.forEach(item => {
    const a = document.createElement("a");
    a.className = "ro-card";
    a.href = repoRoot() + item.url;
    a.innerHTML = `
      <img src="${repoRoot() + item.imagen}" alt="${item.nombre}">
      <div class="ro-card-body">
        <div class="ro-card-title">${item.nombre}</div>
        <div class="ro-card-desc">${item.descripcion}</div>
      </div>
    `;
    grid.appendChild(a);
  });
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  try {
    const data = await loadJson("data/ragnarok.json");
    const d1 = document.getElementById("ro-descripcion");
    if (d1) d1.textContent = data.descripcion;
    renderServidor(data.servidor);
    renderGaleria(data.galeria);
    renderVideos(data.videos);
    renderCards(data.guias,  "guias-grid");
    renderCards(data.builds, "builds-grid");
  } catch(e) {
    console.error("ragnarok.json:", e);
  }
});