import { getUser, apiFetch } from "../auth.js";

const API    = "https://sunshinesquad.es/api";
const params = new URLSearchParams(location.search);
const GAME   = params.get("game");   // game_key (siempre requerido)
const SLUG   = params.get("slug");   // si existe → modo edición
const TIPO   = params.get("tipo");   // 'guia' o 'build' (nuevo post)

let editingId = null;

document.addEventListener("DOMContentLoaded", async () => {
  const user = getUser();
  if (!user || !["admin","moderador","editor"].includes(user.role)) {
    document.getElementById("access-denied").style.display = "block";
    return;
  }
  document.getElementById("editor-content").style.display = "block";
  const badge = document.getElementById("admin-role-badge");
  if (badge) badge.textContent = { admin:"Admin", moderador:"Moderador", editor:"Editor" }[user.role] || user.role;

  // Botón volver
  document.getElementById("btn-back").addEventListener("click", () => {
    if (GAME) window.location.href = `../juegos/${GAME}/${GAME}.html`;
    else history.back();
  });

  // Pre-seleccionar tipo si viene por URL
  if (TIPO && ["guia","build"].includes(TIPO)) {
    document.getElementById("f-tipo").value = TIPO;
  }

  // Si hay slug → modo edición: cargar datos
  if (SLUG && GAME) {
    await loadExisting();
  } else {
    document.getElementById("editor-title").textContent = "✏️ Nueva publicación";
    updateSubtitle();
  }

  bindForm();
  bindPortadaPreview();
  bindPreviewToggle();
});

function updateSubtitle() {
  const tipo = document.getElementById("f-tipo").value;
  const game = GAME || "";
  document.getElementById("editor-subtitle").textContent =
    `${tipo === "build" ? "🔧 Build" : "📖 Guía"} · ${game}`;
}

async function loadExisting() {
  try {
    const res = await apiFetch(`/content/${GAME}/${SLUG}`);
    if (!res?.ok) throw new Error("not found");
    const post = await res.json();

    editingId = post.id;
    document.getElementById("editor-title").textContent   = "✏️ Editar publicación";
    document.getElementById("editor-subtitle").textContent = `${post.tipo === "build" ? "🔧 Build" : "📖 Guía"} · ${GAME}`;

    document.getElementById("f-tipo").value      = post.tipo;
    document.getElementById("f-tipo").disabled   = true; // no cambiar tipo al editar
    document.getElementById("f-titulo").value    = post.titulo;
    document.getElementById("f-resumen").value   = post.resumen || "";
    document.getElementById("f-portada").value   = post.portada || "";
    document.getElementById("f-contenido").value = post.contenido;
    document.getElementById("f-publicado").checked = !!post.publicado;

    // Trigger preview de portada
    document.getElementById("f-portada").dispatchEvent(new Event("input"));
  } catch {
    toast("Error al cargar el post", true);
  }
}

function bindForm() {
  document.getElementById("f-tipo").addEventListener("change", updateSubtitle);

  document.getElementById("btn-guardar").addEventListener("click", async () => {
    const titulo    = document.getElementById("f-titulo").value.trim();
    const resumen   = document.getElementById("f-resumen").value.trim();
    const portada   = document.getElementById("f-portada").value.trim();
    const contenido = document.getElementById("f-contenido").value.trim();
    const publicado = document.getElementById("f-publicado").checked;
    const tipo      = document.getElementById("f-tipo").value;

    if (!titulo) return toast("El título es requerido", true);
    if (!GAME)   return toast("Falta el game_key en la URL", true);

    const btn = document.getElementById("btn-guardar");
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
      let res;
      if (editingId) {
        res = await apiFetch(`/content/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({ titulo, resumen, portada, contenido, publicado }),
        });
      } else {
        res = await apiFetch("/content", {
          method: "POST",
          body: JSON.stringify({ tipo, game_key: GAME, titulo, resumen, portada, contenido, publicado }),
        });
      }

      if (res?.ok) {
        const data = await res.json();
        toast(editingId ? "Publicación actualizada" : "Publicación creada");
        // Redirigir al viewer tras 1 segundo
        const slug = editingId ? SLUG : data.slug;
        setTimeout(() => {
          window.location.href = `guia.html?game=${GAME}&slug=${slug}`;
        }, 800);
      } else {
        const err = await res?.json().catch(() => ({}));
        toast(err?.error || "Error al guardar", true);
        btn.disabled = false;
        btn.textContent = "Guardar";
      }
    } catch {
      toast("Error de conexión", true);
      btn.disabled = false;
      btn.textContent = "Guardar";
    }
  });
}

function bindPortadaPreview() {
  document.getElementById("f-portada").addEventListener("input", function () {
    const val  = this.value.trim();
    const wrap = document.getElementById("portada-preview");
    const img  = document.getElementById("portada-img");
    if (val) {
      img.src = val;
      wrap.style.display = "block";
      img.onerror = () => { wrap.style.display = "none"; };
    } else {
      wrap.style.display = "none";
    }
  });
}

function bindPreviewToggle() {
  const btn      = document.getElementById("btn-preview-toggle");
  const textarea = document.getElementById("f-contenido");
  const preview  = document.getElementById("content-preview");
  let showing = false;

  btn.addEventListener("click", () => {
    showing = !showing;
    if (showing) {
      const html = textarea.value;
      const looksLikeHtml = /<[a-z][\s\S]*>/i.test(html);
      preview.innerHTML = looksLikeHtml
        ? html
        : (typeof marked !== "undefined" ? marked.parse(html) : html.replace(/\n/g, "<br>"));
      textarea.style.display = "none";
      preview.style.display  = "block";
      btn.textContent = "✏️ Editar";
    } else {
      textarea.style.display = "block";
      preview.style.display  = "none";
      btn.textContent = "👁️ Vista previa";
    }
  });
}

function toast(msg, isError = false) {
  const el = document.getElementById("admin-toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show${isError ? " error" : ""}`;
  setTimeout(() => el.className = "", 3000);
}
