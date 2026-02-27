import { loadJson, repoRoot } from "../app.js";

// ── Render grid ────────────────────────────────────────────
function renderJuegos(juegos) {
  const grid = document.getElementById("juegos-grid");
  if (!grid) return;

  juegos.forEach(j => {
    const a = document.createElement("a");
    a.className = "juego-card";
    a.href = repoRoot() + j.url;

    // Badges
    let badges = "";
    if (j.guild) badges += `<span class="badge-guild">⭐ GUILD</span>`;
    if (j.serie) badges += `<span class="badge-serie">🎬 SERIE</span>`;

    // Data para filtros
    if (j.guild) a.dataset.guild = "true";
    if (j.serie) a.dataset.serie = "true";

    a.innerHTML = `
      ${badges ? `<div class="juego-badges">${badges}</div>` : ""}
      <img src="${repoRoot() + j.imagen}" alt="${j.nombre}"
           onerror="this.style.minHeight='200px'">
      <div class="juego-card-overlay">
        <div class="juego-card-nombre">${j.nombre}</div>
        <div class="juego-card-servidor">${j.servidor}</div>
      </div>
    `;

    grid.appendChild(a);
  });
}

// ── Filtros ────────────────────────────────────────────────
function initFiltros() {
  const btns  = document.querySelectorAll(".filtro-btn");
  const grid  = document.getElementById("juegos-grid");

  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const filtro = btn.dataset.filtro;
      const cards  = grid.querySelectorAll(".juego-card");

      cards.forEach(card => {
        if (filtro === "todos") {
          card.classList.remove("hidden");
        } else if (filtro === "guild") {
          card.classList.toggle("hidden", !card.dataset.guild);
        } else if (filtro === "serie") {
          card.classList.toggle("hidden", !card.dataset.serie);
        }
      });
    });
  });
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await loadJson("data/games.json");

    const desc = document.getElementById("juegos-descripcion");
    if (desc) desc.textContent = data.descripcion;

    renderJuegos(data.juegos);
    initFiltros();
  } catch(e) {
    console.error("games.json:", e);
  }
});