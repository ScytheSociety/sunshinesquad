const API = "https://sunshinesquad.es/api";

// Calcula la ruta raíz relativa desde la ubicación de esta página
function rootUrl() {
  const depth = location.pathname.split("/").filter(Boolean).length - 1;
  return depth > 0 ? "../".repeat(depth) : "./";
}

let todosLosJuegos = [];

// ── Aplicar filtro + búsqueda ─────────────────────────────────────────────
function applyFilter() {
  const activeFiltro = document.querySelector(".filtro-btn.active")?.dataset.filtro || "todos";
  const q = document.getElementById("juegos-search")?.value.trim().toLowerCase() || "";

  document.querySelectorAll(".juego-card").forEach(card => {
    const id = parseInt(card.dataset.id);
    const j  = todosLosJuegos.find(g => g.id === id);
    if (!j) { card.classList.add("hidden"); return; }

    const matchesFiltro =
      activeFiltro === "todos"  ? true :
      activeFiltro === "guild"  ? !!j.guild :
      activeFiltro === "serie"  ? !!j.serie :
      activeFiltro === "sss"    ? !!j.sss :
      true;
    const matchesQ = !q ||
      j.nombre.toLowerCase().includes(q) ||
      (j.descripcion || "").toLowerCase().includes(q);

    card.classList.toggle("hidden", !(matchesFiltro && matchesQ));
  });
}

// ── Render grid ───────────────────────────────────────────────────────────
function renderJuegos(juegos) {
  const grid = document.getElementById("juegos-grid");
  if (!grid) return;
  grid.innerHTML = "";

  juegos.forEach(j => {
    const a = document.createElement("a");
    a.className  = "juego-card";
    a.dataset.id = j.id;

    if (j.url) {
      a.href = j.url.startsWith("http") ? j.url : rootUrl() + j.url;
    } else {
      a.href = "#";
      a.style.cursor = "default";
    }

    const imgSrc = j.imagen
      ? (j.imagen.startsWith("http") ? j.imagen : rootUrl() + j.imagen)
      : "";

    let badges = "";
    if (j.guild) badges += `<span class="badge-guild">⭐ GUILD</span>`;
    if (j.serie) badges += `<span class="badge-serie">🎬 SERIE</span>`;
    if (j.sss)   badges += `<span class="badge-sss">🎮 SSS</span>`;

    a.innerHTML = `
      <div class="juego-card-img-wrap">
        ${badges ? `<div class="juego-badges">${badges}</div>` : ""}
        ${imgSrc
          ? `<img src="${imgSrc}" alt="${j.nombre}" loading="lazy">`
          : `<div class="juego-card-placeholder">🎮</div>`}
      </div>
      <div class="juego-card-caption">
        <div class="juego-card-nombre">${j.nombre}</div>
        ${j.descripcion ? `<div class="juego-card-desc">${j.descripcion}</div>` : ""}
      </div>
    `;

    grid.appendChild(a);
  });
}

// ── Controles: filtros y búsqueda ─────────────────────────────────────────
function initControls() {
  document.querySelectorAll(".filtro-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilter();
    });
  });

  const search = document.getElementById("juegos-search");
  if (search) {
    let t;
    search.addEventListener("input", () => { clearTimeout(t); t = setTimeout(applyFilter, 250); });
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(`${API}/games`);
    if (!res.ok) throw new Error("API error");
    const allGames = await res.json();
    todosLosJuegos = allGames.filter(g => g.activo !== 0);
    renderJuegos(todosLosJuegos);
    initControls();
  } catch (e) {
    console.error("juegos:", e);
    const grid = document.getElementById("juegos-grid");
    if (grid) grid.innerHTML =
      `<div style="color:rgba(255,255,255,.3);padding:2rem;grid-column:1/-1;">Error al cargar juegos.</div>`;
  }
});
