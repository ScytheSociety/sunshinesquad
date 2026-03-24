const API = "https://sunshinesquad.es/api";

// Compute root URL from this page's location (pages/juegos/juegos.html → ../../)
function rootUrl() {
  const depth = location.pathname.split("/").filter(Boolean).length - 1;
  return depth > 0 ? "../".repeat(depth) : "./";
}

let todosLosJuegos = [];
let filteredGames  = [];
let current = 0;
const VISIBLE_DESKTOP = 10;
const GAP = 10;

// ── Cuántos items según pantalla ───────────────────────────────────
function getVisible() {
  const w = window.innerWidth;
  if (w < 480)  return 2;
  if (w < 640)  return 3;
  if (w < 900)  return 5;
  if (w < 1200) return 7;
  return VISIBLE_DESKTOP;
}

// ── Anchos de cards ───────────────────────────────────────────────
function setWidths() {
  const vis  = getVisible();
  const wrap = document.querySelector(".showcase-strip-wrap");
  const containerW = wrap ? wrap.offsetWidth : window.innerWidth - 120;
  const w = (containerW - GAP * (vis - 1)) / vis;
  document.querySelectorAll(".juego-card").forEach(c => { c.style.width = w + "px"; });
  return { w, vis };
}

// ── Ir a posición ─────────────────────────────────────────────────
function goTo(idx) {
  const { w, vis } = setWidths();
  const visible = filteredGames.filter(g => {
    const card = document.querySelector(`.juego-card[data-id="${g.id}"]`);
    return card && !card.classList.contains("hidden");
  });
  const max = Math.max(0, visible.length - vis);
  current = Math.max(0, Math.min(idx, max));

  const strip = document.getElementById("showcase-strip");
  strip.style.transform = `translateX(-${current * (w + GAP)}px)`;

  document.getElementById("showcase-prev").disabled = current === 0;
  document.getElementById("showcase-next").disabled = current >= max;
}

// ── Aplicar filtro + búsqueda ─────────────────────────────────────
function applyFilter() {
  current = 0;
  const activeFiltro = document.querySelector(".filtro-btn.active")?.dataset.filtro || "todos";
  const q = document.getElementById("juegos-search")?.value.trim().toLowerCase() || "";

  filteredGames = todosLosJuegos.filter(g => {
    if (!g.activo) return false;
    const matchesFiltro =
      activeFiltro === "todos"  ? true :
      activeFiltro === "guild"  ? !!g.guild :
      activeFiltro === "serie"  ? !!g.serie :
      activeFiltro === "sss"    ? !!g.sss :
      true;
    const matchesQ = !q || g.nombre.toLowerCase().includes(q) || (g.descripcion || "").toLowerCase().includes(q);
    return matchesFiltro && matchesQ;
  });

  document.querySelectorAll(".juego-card").forEach(card => {
    const id = parseInt(card.dataset.id);
    const hide = !filteredGames.find(g => g.id === id);
    card.classList.toggle("hidden", hide);
  });

  setTimeout(() => goTo(0), 20);
}

// ── Render cards ──────────────────────────────────────────────────
function renderJuegos(juegos) {
  const strip = document.getElementById("showcase-strip");
  if (!strip) return;
  strip.innerHTML = "";

  juegos.forEach(j => {
    const a = document.createElement("a");
    a.className = "juego-card";
    a.dataset.id = j.id;
    if (j.url) {
      a.href = j.url.startsWith("http") ? j.url : rootUrl() + j.url;
    } else {
      a.href = "#";
      a.style.cursor = "default";
    }
    if (j.guild) a.dataset.guild = "true";
    if (j.serie) a.dataset.serie = "true";
    if (j.sss)   a.dataset.sss   = "true";

    const imgSrc = j.imagen
      ? (j.imagen.startsWith("http") ? j.imagen : rootUrl() + j.imagen)
      : "";

    let badges = "";
    if (j.guild) badges += `<span class="badge-guild">⭐ GUILD</span>`;
    if (j.serie) badges += `<span class="badge-serie">🎬 SERIE</span>`;
    if (j.sss)   badges += `<span class="badge-sss">🎮 SSS</span>`;

    a.innerHTML = `
      ${badges ? `<div class="juego-badges">${badges}</div>` : ""}
      ${imgSrc
        ? `<img src="${imgSrc}" alt="${j.nombre}" loading="lazy">`
        : `<div style="width:100%;aspect-ratio:9/16;background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;font-size:2rem;color:rgba(255,255,255,.2);">🎮</div>`}
      <div class="juego-card-overlay">
        <div class="juego-card-nombre">${j.nombre}</div>
        ${j.servidor ? `<div class="juego-card-servidor">${j.servidor}</div>` : ""}
        ${j.descripcion ? `<div class="juego-card-desc">${j.descripcion}</div>` : ""}
      </div>
    `;
    strip.appendChild(a);
  });
}

// ── Filtros y búsqueda ────────────────────────────────────────────
function initControls() {
  // Filter buttons
  document.querySelectorAll(".filtro-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilter();
    });
  });

  // Search
  const search = document.getElementById("juegos-search");
  if (search) {
    let t;
    search.addEventListener("input", () => { clearTimeout(t); t = setTimeout(applyFilter, 250); });
  }

  // Arrows
  document.getElementById("showcase-prev")?.addEventListener("click", () => goTo(current - 1));
  document.getElementById("showcase-next")?.addEventListener("click", () => goTo(current + 1));
  window.addEventListener("resize", () => goTo(current));
}

// ── Init ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(`${API}/games`);
    if (!res.ok) throw new Error("API error");
    todosLosJuegos = await res.json();
    filteredGames  = todosLosJuegos.filter(g => g.activo !== 0);

    renderJuegos(todosLosJuegos);
    initControls();
    setTimeout(() => goTo(0), 80);
  } catch(e) {
    console.error("juegos:", e);
    const strip = document.getElementById("showcase-strip");
    if (strip) strip.innerHTML = `<div style="color:rgba(255,255,255,.3);padding:2rem;">Error al cargar juegos.</div>`;
  }
});
