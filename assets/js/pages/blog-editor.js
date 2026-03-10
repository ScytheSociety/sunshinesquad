import { getUser, apiFetch } from "../auth.js";

const API      = "https://sunshinesquad.es/api";
const slugParam = new URLSearchParams(location.search).get("slug");
const ROLES    = ["editor","moderador","admin"];

function toSlug(str) {
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9\s-]/g,"")
    .trim().replace(/\s+/g,"-");
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = getUser();

  if (!user || !ROLES.includes(user.role)) {
    document.getElementById("access-denied").style.display = "block";
    return;
  }

  document.getElementById("editor-wrap").style.display = "block";

  // Auto-slug desde título
  const titulo = document.getElementById("f-titulo");
  const slugEl = document.getElementById("f-slug");
  titulo.addEventListener("input", () => {
    if (!slugParam) slugEl.value = toSlug(titulo.value);
  });

  // Si es edición, carga el post
  if (slugParam) {
    document.getElementById("editor-title").textContent = "Editar post";
    try {
      const res  = await fetch(`${API}/blog/${slugParam}`);
      const post = await res.json();
      titulo.value                              = post.titulo;
      slugEl.value                              = post.slug;
      document.getElementById("f-juego").value    = post.juego || "";
      document.getElementById("f-resumen").value  = post.resumen || "";
      document.getElementById("f-contenido").value = post.contenido;
      document.getElementById("f-publicado").checked = !!post.publicado;
    } catch {
      alert("No se pudo cargar el post para editar.");
    }
  }

  // Guardar
  document.getElementById("save-btn").addEventListener("click", async () => {
    const msg = document.getElementById("save-msg");
    const body = {
      slug:      document.getElementById("f-slug").value.trim(),
      titulo:    document.getElementById("f-titulo").value.trim(),
      resumen:   document.getElementById("f-resumen").value.trim(),
      contenido: document.getElementById("f-contenido").value.trim(),
      juego:     document.getElementById("f-juego").value || null,
      publicado: document.getElementById("f-publicado").checked,
    };

    if (!body.slug || !body.titulo || !body.contenido) {
      msg.style.color = "#f87171";
      msg.textContent = "Título, slug y contenido son obligatorios.";
      return;
    }

    msg.style.color = "rgba(255,255,255,.4)";
    msg.textContent = "Guardando...";

    try {
      const res = slugParam
        ? await apiFetch(`/blog/${slugParam}`, { method:"PUT",  body: JSON.stringify(body) })
        : await apiFetch(`/blog`,              { method:"POST", body: JSON.stringify(body) });

      if (!res || !res.ok) throw new Error("Error");

      msg.style.color = "#86efac";
      msg.textContent = "✓ Guardado correctamente.";
      setTimeout(() => window.location.href = `post.html?slug=${body.slug}`, 1200);
    } catch {
      msg.style.color = "#f87171";
      msg.textContent = "Error al guardar. Intenta de nuevo.";
    }
  });
});
