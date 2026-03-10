import { getUser } from "../auth.js";

const API = "https://sunshinesquad.es/api";

let paginaActual = 1;
let juegoActual  = null;
const JUEGOS     = ["Ragnarok Online", "World of Warcraft", "Lineage 2", "Brawl Stars", "Throne & Liberty"];

// ── Renderiza lista de posts ───────────────────────────────────────
async function loadPosts(page = 1, juego = null) {
  paginaActual = page;
  juegoActual  = juego;

  const grid = document.getElementById("posts-grid");
  const pag  = document.getElementById("paginacion");
  grid.innerHTML = `<div class="col-12 text-center py-5"><div style="color:rgba(255,255,255,.3);">Cargando...</div></div>`;
  pag.innerHTML  = "";

  try {
    const params = new URLSearchParams({ page });
    if (juego) params.set("juego", juego);
    const res  = await fetch(`${API}/blog?${params}`);
    const data = await res.json();

    if (!data.posts?.length) {
      grid.innerHTML = `<div class="col-12 text-center py-5" style="color:rgba(255,255,255,.3);">No hay posts aún.</div>`;
      return;
    }

    grid.innerHTML = data.posts.map(p => `
      <div class="col-md-6 col-lg-4">
        <a class="blog-card h-100" href="post.html?slug=${p.slug}">
          ${p.juego ? `<span class="blog-card-game">${p.juego}</span>` : ""}
          <div class="blog-card-title">${p.titulo}</div>
          ${p.resumen ? `<div class="blog-card-summary">${p.resumen}</div>` : ""}
          <div class="blog-card-meta">
            <span>${p.autor_nombre}</span>
            <span>${new Date(p.created_at).toLocaleDateString("es", { day:"numeric", month:"short", year:"numeric" })}</span>
            ${p.rating ? `<span>${renderStarsStatic(p.rating)} ${p.rating} (${p.votos})</span>` : ""}
          </div>
        </a>
      </div>`).join("");

    renderPaginacion(pag, data.page, data.paginas);

  } catch {
    grid.innerHTML = `<div class="col-12 text-center py-5" style="color:rgba(255,255,255,.25);">Error al cargar el blog.</div>`;
  }
}

function renderStarsStatic(rating) {
  return Array.from({length:5}, (_,i) =>
    `<span style="color:${i < Math.round(rating) ? "#fbbf24" : "rgba(255,255,255,.15)"}">★</span>`
  ).join("");
}

function renderPaginacion(el, page, total) {
  if (total <= 1) return;
  el.innerHTML = "";

  const prev = document.createElement("button");
  prev.className   = "blog-pag-btn";
  prev.textContent = "← Anterior";
  prev.disabled    = page === 1;
  prev.onclick     = () => loadPosts(page - 1, juegoActual);
  el.appendChild(prev);

  for (let i = 1; i <= total; i++) {
    const btn = document.createElement("button");
    btn.className   = "blog-pag-btn" + (i === page ? " active" : "");
    btn.textContent = i;
    btn.onclick     = () => loadPosts(i, juegoActual);
    el.appendChild(btn);
  }

  const next = document.createElement("button");
  next.className   = "blog-pag-btn";
  next.textContent = "Siguiente →";
  next.disabled    = page === total;
  next.onclick     = () => loadPosts(page + 1, juegoActual);
  el.appendChild(next);
}

// ── Filtros ────────────────────────────────────────────────────────
function renderFiltros() {
  const el = document.getElementById("filtros");
  if (!el) return;

  const todos = document.createElement("button");
  todos.className   = "blog-filter-btn active";
  todos.textContent = "Todos";
  todos.onclick     = () => { setFiltroActivo(todos); loadPosts(1, null); };
  el.appendChild(todos);

  JUEGOS.forEach(j => {
    const btn = document.createElement("button");
    btn.className   = "blog-filter-btn";
    btn.textContent = j;
    btn.onclick     = () => { setFiltroActivo(btn); loadPosts(1, j); };
    el.appendChild(btn);
  });
}

function setFiltroActivo(btn) {
  document.querySelectorAll(".blog-filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

// ── Botón nuevo post (solo editors+) ──────────────────────────────
function renderNewPostBtn() {
  const wrap = document.getElementById("new-post-btn-wrap");
  if (!wrap) return;
  const user = getUser();
  const ROLES_EDITOR = ["editor", "moderador", "admin"];
  if (user && ROLES_EDITOR.includes(user.role)) {
    wrap.innerHTML = `<a href="editor.html" class="btn-ss active" style="text-decoration:none;display:inline-flex;align-items:center;gap:.4rem;">✏️ Nuevo post</a>`;
  }
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderFiltros();
  renderNewPostBtn();
  loadPosts(1);
});
