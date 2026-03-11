import { getUser, apiFetch } from "../auth.js";

const API = "https://sunshinesquad.es/api";
const slug = new URLSearchParams(location.search).get("slug");

// ── Carga y renderiza el post ──────────────────────────────────────
async function loadPost() {
  const wrap = document.getElementById("post-wrap");
  if (!slug) { wrap.innerHTML = `<div class="card-dark" style="color:rgba(255,255,255,.4);">Post no encontrado.</div>`; return; }

  try {
    const res  = await fetch(`${API}/blog/${slug}`);
    if (!res.ok) throw new Error("not found");
    const post = await res.json();

    document.title = `${post.titulo} · Blog · Sunshine Squad`;
    const breadcrumb = document.getElementById("breadcrumb-title");
    if (breadcrumb) breadcrumb.textContent = post.titulo;

    const fecha = new Date(post.created_at).toLocaleDateString("es", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

    const user      = getUser();
    const canEdit   = user && (user.discord_id === post.autor_id || ["admin","moderador"].includes(user.role));

    wrap.innerHTML = `
      <div class="card-dark">
        <div class="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            ${post.juego ? `<span style="font-size:.72rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:.15rem .55rem;border-radius:999px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:#a5b4fc;">${post.juego}</span>` : ""}
            <span style="font-size:.78rem;color:rgba(255,255,255,.3);">${fecha}</span>
          </div>
          ${canEdit ? `<div class="d-flex gap-2">
            <a href="editor.html?slug=${post.slug}" class="btn-ss active" style="font-size:.75rem;padding:.3rem .7rem;text-decoration:none;">✏️ Editar</a>
            <button id="btn-delete-post" class="btn-ss" style="font-size:.75rem;padding:.3rem .7rem;color:#fca5a5;border-color:rgba(239,68,68,.35);">🗑️ Eliminar</button>
          </div>` : ""}
        </div>
        <h1 style="font-weight:900;font-size:clamp(1.5rem,4vw,2.2rem);line-height:1.2;margin-bottom:.75rem;">${post.titulo}</h1>
        <div style="font-size:.85rem;color:rgba(255,255,255,.4);margin-bottom:2rem;">Por <strong style="color:rgba(255,255,255,.6);">${post.autor_nombre}</strong></div>
        <div class="post-content">${post.contenido}</div>
      </div>`;

    if (canEdit) {
      document.getElementById("btn-delete-post")?.addEventListener("click", async () => {
        if (!confirm("¿Eliminar este post? Esta acción no se puede deshacer.")) return;
        try {
          const r = await apiFetch(`/blog/${slug}`, { method: "DELETE" });
          if (!r || !r.ok) throw new Error("Error");
          window.location.href = "index.html";
        } catch { alert("Error al eliminar el post."); }
      });
    }

    initRating(post);
    loadComentarios(1);

  } catch {
    wrap.innerHTML = `<div class="card-dark" style="color:rgba(255,255,255,.4);">Post no encontrado o no disponible.</div>`;
  }
}

// ── Rating ─────────────────────────────────────────────────────────
function initRating(post) {
  const wrap = document.getElementById("rating-wrap");
  const info = document.getElementById("rating-info");
  const msg  = document.getElementById("rating-msg");
  if (!wrap) return;

  wrap.style.display = "block";
  if (post.rating) {
    info.innerHTML = `Promedio: <strong style="color:#fbbf24;">${post.rating} ★</strong> · ${post.votos} voto${post.votos !== 1 ? "s" : ""}`;
  }

  const stars = document.querySelectorAll("#star-rating .star");
  const user  = getUser();

  if (!user) {
    msg.innerHTML = `<a href="${API}/auth/discord" style="color:#a5b4fc;">Inicia sesión</a> para calificar.`;
    stars.forEach(s => s.style.cursor = "default");
    return;
  }

  stars.forEach(star => {
    star.addEventListener("mouseenter", () => highlightStars(stars, +star.dataset.v));
    star.addEventListener("mouseleave", () => highlightStars(stars, 0));
    star.addEventListener("click", async () => {
      const v = +star.dataset.v;
      highlightStars(stars, v, true);
      msg.textContent = "Guardando...";
      try {
        const res  = await apiFetch(`/blog/${slug}/rating`, { method:"POST", body: JSON.stringify({ estrellas: v }) });
        const data = await res.json();
        info.innerHTML = `Promedio: <strong style="color:#fbbf24;">${data.rating} ★</strong> · ${data.votos} voto${data.votos !== 1 ? "s" : ""}`;
        msg.textContent = "¡Gracias por tu voto!";
        setTimeout(() => msg.textContent = "", 2000);
      } catch {
        msg.textContent = "Error al guardar el voto.";
      }
    });
  });
}

function highlightStars(stars, val, permanent = false) {
  stars.forEach(s => {
    const filled = +s.dataset.v <= val;
    s.classList.toggle("filled", filled && permanent);
    s.classList.toggle("hover",  filled && !permanent);
    if (!permanent && val === 0) s.classList.remove("hover");
  });
}

// ── Comentarios ────────────────────────────────────────────────────
async function loadComentarios(page = 1) {
  const list  = document.getElementById("comentarios-list");
  const count = document.getElementById("comentarios-count");
  const pag   = document.getElementById("comentarios-pag");
  list.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;">Cargando comentarios...</div>`;

  try {
    const res  = await fetch(`${API}/blog/${slug}/comentarios?page=${page}`);
    const data = await res.json();

    if (count) count.textContent = `(${data.total})`;

    if (!data.comentarios?.length) {
      list.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:.85rem;">Sin comentarios aún. ¡Sé el primero!</div>`;
    } else {
      list.innerHTML = data.comentarios.map(c => `
        <div class="comment-card">
          <div class="d-flex align-items-start gap-2">
            ${c.autor_avatar
              ? `<img src="${c.autor_avatar}" alt="${c.autor_nombre}" class="comment-avatar">`
              : `<div class="comment-avatar d-flex align-items-center justify-content-center" style="background:rgba(99,102,241,.2);font-size:.8rem;">👤</div>`}
            <div style="flex:1;min-width:0;">
              <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                <span style="font-weight:700;font-size:.88rem;color:#fff;">${c.autor_nombre}</span>
                <span style="font-size:.72rem;color:rgba(255,255,255,.3);">${new Date(c.created_at).toLocaleDateString("es", { day:"numeric", month:"short", year:"numeric" })}</span>
              </div>
              <div style="font-size:.875rem;color:rgba(255,255,255,.65);line-height:1.6;">${escapeHtml(c.contenido)}</div>
            </div>
          </div>
        </div>`).join("");
    }

    renderComPaginacion(pag, page, data.paginas, loadComentarios);
  } catch {
    list.innerHTML = `<div style="color:rgba(255,255,255,.2);font-size:.82rem;">Error al cargar comentarios.</div>`;
  }
}

function renderComPaginacion(el, page, total, fn) {
  el.innerHTML = "";
  if (total <= 1) return;
  for (let i = 1; i <= total; i++) {
    const btn = document.createElement("button");
    btn.className   = "blog-pag-btn" + (i === page ? " active" : "");
    btn.textContent = i;
    btn.onclick     = () => fn(i);
    el.appendChild(btn);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
}

// ── Formulario comentario ──────────────────────────────────────────
function initCommentForm() {
  const user       = getUser();
  const formWrap   = document.getElementById("comment-form");
  const loginMsg   = document.getElementById("comment-login-msg");
  const loginLink  = document.getElementById("comment-login-link");
  const submitBtn  = document.getElementById("comment-submit");
  const textarea   = document.getElementById("comment-text");

  if (loginLink) loginLink.href = `${API}/auth/discord`;

  if (!user) {
    if (loginMsg) loginMsg.style.display = "block";
    return;
  }
  if (formWrap) formWrap.style.display = "block";

  submitBtn?.addEventListener("click", async () => {
    const contenido = textarea?.value?.trim();
    if (!contenido) return;
    submitBtn.disabled = true;
    submitBtn.textContent = "Publicando...";
    try {
      await apiFetch(`/blog/${slug}/comentarios`, { method:"POST", body: JSON.stringify({ contenido }) });
      textarea.value = "";
      await loadComentarios(1);
    } catch {
      alert("Error al publicar el comentario.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Publicar";
    }
  });
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (!slug) return;
  loadPost();
  initCommentForm();
});
