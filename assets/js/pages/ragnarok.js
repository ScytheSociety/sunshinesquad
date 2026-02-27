import { loadJson, repoRoot } from "../app.js";

// ── Pestañas ───────────────────────────────────────────────
function initTabs() {
  const btns = document.querySelectorAll(".tab-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      // Desactiva todos los botones y oculta todos los contenidos
      btns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");

      // Activa el seleccionado
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).style.display = "block";
    });
  });
}

// ── Galería ────────────────────────────────────────────────
function renderGaleria(items) {
  const strip = document.getElementById("galeria-strip");
  if (!strip) return;

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "galeria-item";
    div.innerHTML = `
      <img src="${repoRoot() + item.imagen}" alt="${item.titulo}"
           onerror="this.style.minHeight='140px'">
      <div class="galeria-item-titulo">${item.titulo}</div>
    `;
    strip.appendChild(div);
  });
}

// ── Cards de guías o builds ────────────────────────────────
function renderCards(items, containerId) {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  items.forEach(item => {
    const a = document.createElement("a");
    a.className = "ro-card";
    a.href = repoRoot() + item.url;
    a.innerHTML = `
      <img src="${repoRoot() + item.imagen}" alt="${item.nombre}"
           onerror="this.style.minHeight='110px'">
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

    // Descripción
    const d1 = document.getElementById("ro-descripcion");
    const d2 = document.getElementById("ro-descripcion-2");
    if (d1) d1.textContent = data.descripcion;
    if (d2) d2.textContent = data.descripcion;

    // Galería
    renderGaleria(data.galeria);

    // Guías y builds
    renderCards(data.guias,  "guias-grid");
    renderCards(data.builds, "builds-grid");

  } catch(e) {
    console.error("ragnarok.json:", e);
  }
});