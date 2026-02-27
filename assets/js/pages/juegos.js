import { loadJson, repoRoot } from "../app.js";

let todosLosJuegos = [];
let current = 0;
const VISIBLE = 5;
const GAP = 14;

// ── Cuántos items según pantalla ───────────────────────────
function getVisible() {
  const w = window.innerWidth;
  if (w < 480)  return 1;
  if (w < 768)  return 2;
  if (w < 1024) return 3;
  if (w < 1280) return 4;
  return VISIBLE;
}

// ── Items visibles según filtro activo ────────────────────
function getVisibleCards() {
  const strip = document.getElementById("showcase-strip");
  return [...strip.querySelectorAll(".juego-card:not(.hidden)")];
}

// ── Calcular anchos ───────────────────────────────────────
function setWidths(cards) {
  const vis        = getVisible();
  const stripWrap  = document.querySelector(".showcase-strip-wrap");
  const containerW = stripWrap ? stripWrap.offsetWidth : window.innerWidth - 120;
  const w          = (containerW - GAP * (vis - 1)) / vis;
  cards.forEach(c => { c.style.width = w + "px"; });
  return { w, vis };
}

// ── Actualizar dots ───────────────────────────────────────
function updateDots(cards) {
  const dotsEl = document.getElementById("showcase-dots");
  if (!dotsEl) return;
  dotsEl.innerHTML = "";
  const vis = getVisible();
  const max = Math.max(0, cards.length - vis);
  for (let i = 0; i <= max; i++) {
    const dot = document.createElement("div");
    dot.className = "showcase-dot" + (i === current ? " active" : "");
    dot.addEventListener("click", () => goTo(i, cards));
    dotsEl.appendChild(dot);
  }
}

// ── Ir a posición ─────────────────────────────────────────
function goTo(idx, cards) {
  const { w, vis } = setWidths(cards);
  const max = Math.max(0, cards.length - vis);
  current = Math.max(0, Math.min(idx, max));

  // Calcular offset: saltar `current` cards incluyendo gaps
  const offset = current * (w + GAP);
  const strip = document.getElementById("showcase-strip");
  strip.style.transform = `translateX(-${offset}px)`;

  updateDots(cards);

  const btnPrev = document.getElementById("showcase-prev");
  const btnNext = document.getElementById("showcase-next");
  if (btnPrev) btnPrev.disabled = current === 0;
  if (btnNext) btnNext.disabled = current >= max;
}

// ── Aplicar filtro ────────────────────────────────────────
function applyFiltro(filtro) {
  current = 0;
  const strip = document.getElementById("showcase-strip");
  const todas = [...strip.querySelectorAll(".juego-card")];

  todas.forEach(card => {
    if      (filtro === "todos") card.classList.remove("hidden");
    else if (filtro === "guild") card.classList.toggle("hidden", !card.dataset.guild);
    else if (filtro === "serie") card.classList.toggle("hidden", !card.dataset.serie);
  });

  const visibles = getVisibleCards();
  setTimeout(() => goTo(0, visibles), 20);
}

// ── Render ────────────────────────────────────────────────
function renderJuegos(juegos) {
  const strip = document.getElementById("showcase-strip");
  if (!strip) return;

  juegos.forEach(j => {
    const a = document.createElement("a");
    a.className = "juego-card";
    a.href = repoRoot() + j.url;
    if (j.guild) a.dataset.guild = "true";
    if (j.serie) a.dataset.serie = "true";

    let badges = "";
    if (j.guild) badges += `<span class="badge-guild">⭐ GUILD</span>`;
    if (j.serie) badges += `<span class="badge-serie">🎬 SERIE</span>`;

    a.innerHTML = `
      ${badges ? `<div class="juego-badges">${badges}</div>` : ""}
      <img src="${repoRoot() + j.imagen}" alt="${j.nombre}"
           onerror="this.style.minHeight='220px'">
      <div class="juego-card-overlay">
        <div class="juego-card-nombre">${j.nombre}</div>
        <div class="juego-card-servidor">${j.servidor}</div>
        <div class="juego-card-desc">${j.descripcion}</div>
      </div>
    `;
    strip.appendChild(a);
  });

  const todas = getVisibleCards();
  setTimeout(() => goTo(0, todas), 60);
}

// ── Filtros ───────────────────────────────────────────────
function initFiltros() {
  document.querySelectorAll(".filtro-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyFiltro(btn.dataset.filtro);
    });
  });
}

// ── Flechas ───────────────────────────────────────────────
function initArrows() {
  const btnPrev = document.getElementById("showcase-prev");
  const btnNext = document.getElementById("showcase-next");

  btnPrev?.addEventListener("click", () => {
    goTo(current - 1, getVisibleCards());
  });
  btnNext?.addEventListener("click", () => {
    goTo(current + 1, getVisibleCards());
  });

  window.addEventListener("resize", () => {
    goTo(current, getVisibleCards());
  });
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await loadJson("data/games.json");

    const desc = document.getElementById("juegos-descripcion");
    if (desc) desc.textContent = data.descripcion;

    todosLosJuegos = data.juegos;
    renderJuegos(data.juegos);
    initFiltros();
    initArrows();
  } catch(e) {
    console.error("games.json:", e);
  }
});