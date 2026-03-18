import { getUser } from "../auth.js";

const API = "https://sunshinesquad.es/api";

let paginaActual = 1;
let juegoActual  = null;
let queryActual  = "";
let searchTimer  = null;

// ── Renderiza lista de posts ───────────────────────────────────────
async function loadPosts(page = 1, juego = null, q = "") {
  paginaActual = page;
  juegoActual  = juego;
  queryActual  = q;

  const grid = document.getElementById("posts-grid");
  const pag  = document.getElementById("paginacion");
  grid.innerHTML = `<div class="col-12 text-center py-5"><div style="color:rgba(255,255,255,.3);">Cargando...</div></div>`;
  pag.innerHTML  = "";

  try {
    const params = new URLSearchParams({ page });
    if (juego) params.set("juego", juego);
    if (q)     params.set("q", q);
    const res  = await fetch(`${API}/blog?${params}`);
    const data = await res.json();

    if (!data.posts?.length) {
      grid.innerHTML = `<div class="col-12 text-center py-5" style="color:rgba(255,255,255,.3);">${q ? "No se encontraron posts." : "No hay posts aún."}</div>`;
      return;
    }

    grid.innerHTML = data.posts.map(p => {
      const fecha = new Date(p.created_at).toLocaleDateString("es", { day:"numeric", month:"short", year:"numeric" });
      return `
      <div class="col-md-6 col-lg-4">
        <a class="blog-card h-100" href="post.html?slug=${p.slug}">
          ${p.portada_url
            ? `<img class="blog-card-img" src="${p.portada_url}" alt="${p.titulo}" loading="lazy">`
            : `<div class="blog-card-img-placeholder">📝</div>`}
          <div class="blog-card-body">
            ${p.juego ? `<span class="blog-card-game">${p.juego}</span>` : ""}
            <div class="blog-card-title">${p.titulo}</div>
            ${p.resumen ? `<div class="blog-card-summary">${p.resumen}</div>` : ""}
            <div class="blog-card-meta">
              <span>${p.autor_nombre}</span>
              <span>${fecha}</span>
              ${p.rating ? `<span>${renderStarsStatic(p.rating)} ${p.rating}</span>` : ""}
            </div>
          </div>
        </a>
      </div>`;
    }).join("");

    if (!q) renderPaginacion(pag, data.page, data.paginas);

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
  prev.onclick     = () => loadPosts(page - 1, juegoActual, queryActual);
  el.appendChild(prev);

  for (let i = 1; i <= total; i++) {
    const btn = document.createElement("button");
    btn.className   = "blog-pag-btn" + (i === page ? " active" : "");
    btn.textContent = i;
    btn.onclick     = () => loadPosts(i, juegoActual, queryActual);
    el.appendChild(btn);
  }

  const next = document.createElement("button");
  next.className   = "blog-pag-btn";
  next.textContent = "Siguiente →";
  next.disabled    = page === total;
  next.onclick     = () => loadPosts(page + 1, juegoActual, queryActual);
  el.appendChild(next);
}

// ── Buscador ───────────────────────────────────────────────────────
function renderSearch() {
  const filtros = document.getElementById("filtros");
  if (!filtros) return;
  const inp = document.createElement("input");
  inp.type = "search";
  inp.placeholder = "Buscar por título, autor o palabra clave...";
  inp.style.cssText = "width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:.5rem 1rem;color:#fff;font-size:.85rem;outline:none;margin-bottom:.75rem;";
  filtros.parentElement.insertBefore(inp, filtros);
  inp.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadPosts(1, juegoActual, inp.value.trim()), 320);
  });
}

// ── Filtros ────────────────────────────────────────────────────────
async function renderFiltros() {
  const el = document.getElementById("filtros");
  if (!el) return;

  const todos = document.createElement("button");
  todos.className   = "blog-filter-btn active";
  todos.textContent = "Todos";
  todos.onclick     = () => { setFiltroActivo(todos); loadPosts(1, null, queryActual); };
  el.appendChild(todos);

  try {
    const res   = await fetch(`${API}/games`);
    const games = res.ok ? await res.json() : [];
    games.filter(g => g.activo !== 0).forEach(g => {
      const btn = document.createElement("button");
      btn.className   = "blog-filter-btn";
      btn.textContent = `${g.emoji || "🎮"} ${g.nombre}`;
      btn.onclick     = () => { setFiltroActivo(btn); loadPosts(1, g.nombre, queryActual); };
      el.appendChild(btn);
    });
  } catch {}
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
  if (user && ["editor","moderador","admin"].includes(user.role)) {
    wrap.innerHTML = `<a href="editor.html" class="btn-ss active" style="text-decoration:none;display:inline-flex;align-items:center;gap:.4rem;">✏️ Nuevo post</a>`;
  }
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderSearch();
  renderFiltros();
  renderNewPostBtn();
  loadPosts(1);
});
