// Admin — Gestión de Juegos
import { getUser, apiFetch } from "../auth.js";

let editingId = null;

document.addEventListener("DOMContentLoaded", async () => {
  const user = getUser();
  if (!user || !["admin","moderador","editor"].includes(user.role)) {
    document.getElementById("access-denied").style.display = "block";
    document.getElementById("admin-content").style.display = "none";
    const badge = document.getElementById("admin-role-badge");
    if (badge) badge.textContent = user ? "Sin permisos" : "No autenticado";
    return;
  }
  document.getElementById("admin-content").style.display = "block";
  const badge = document.getElementById("admin-role-badge");
  const roleLabel = { admin:"Admin", moderador:"Moderador", editor:"Editor" }[user.role] || user.role;
  if (badge) badge.textContent = roleLabel;

  // Ocultar delete si no es admin
  if (user.role !== "admin") {
    document.querySelectorAll(".btn-delete-game").forEach(b => b.style.display = "none");
  }

  await loadGames();
  bindForm();

  document.getElementById("btn-new-game").addEventListener("click", () => resetForm());
  document.getElementById("btn-cancel-game").addEventListener("click", () => resetForm());
});

async function loadGames() {
  const el = document.getElementById("games-list");
  el.innerHTML = `<div class="admin-loading">Cargando...</div>`;
  const res = await apiFetch("/games");
  if (!res?.ok) { el.innerHTML = `<div class="admin-empty">Error al cargar juegos</div>`; return; }
  const games = await res.json();
  renderGames(games);
}

function renderGames(games) {
  const el = document.getElementById("games-list");
  if (!games.length) { el.innerHTML = `<div class="admin-empty">Sin juegos registrados</div>`; return; }

  el.innerHTML = `<div class="admin-rows" id="games-rows"></div>`;
  const rows = document.getElementById("games-rows");

  games.forEach(g => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.dataset.id = g.id;
    row.innerHTML = `
      <div class="admin-row-icon" style="background:rgba(99,102,241,.12);color:#a5b4fc;font-size:.7rem;width:42px;height:42px;">
        ${g.imagen ? `<img src="../../${g.imagen}" style="width:42px;height:42px;object-fit:cover;border-radius:6px;" onerror="this.parentNode.textContent='🎮'">` : "🎮"}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="admin-row-name" style="font-size:.85rem;">${g.nombre}</div>
        <div class="admin-row-meta" style="font-size:.7rem;">${[g.guild?"GUILD":"",g.serie?"SERIE":"",g.activo?"":"INACTIVO"].filter(Boolean).join(" · ")||"Sin badges"}</div>
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-sm btn-outline-secondary btn-edit-game" data-id="${g.id}" style="font-size:.7rem;padding:.2rem .5rem;">Editar</button>
        <button class="btn btn-sm btn-outline-danger btn-delete-game" data-id="${g.id}" style="font-size:.7rem;padding:.2rem .5rem;">✕</button>
      </div>`;
    rows.appendChild(row);
  });

  rows.querySelectorAll(".btn-edit-game").forEach(b =>
    b.addEventListener("click", () => editGame(parseInt(b.dataset.id), games))
  );
  rows.querySelectorAll(".btn-delete-game").forEach(b =>
    b.addEventListener("click", () => deleteGame(parseInt(b.dataset.id), b.closest(".admin-row")))
  );

  // Ocultar delete si no es admin
  const user = getUser();
  if (user?.role !== "admin") {
    rows.querySelectorAll(".btn-delete-game").forEach(b => b.style.display = "none");
  }
}

function editGame(id, games) {
  const g = games.find(x => x.id === id);
  if (!g) return;
  editingId = id;
  document.getElementById("form-title").textContent = "Editar juego";
  document.getElementById("f-id").value = g.id;
  document.getElementById("f-nombre").value = g.nombre;
  document.getElementById("f-imagen").value = g.imagen || "";
  document.getElementById("f-descripcion").value = g.descripcion || "";
  document.getElementById("f-servidor").value = g.servidor || "";
  document.getElementById("f-url").value = g.url || "";
  document.getElementById("f-guild").checked = !!g.guild;
  document.getElementById("f-serie").checked = !!g.serie;
  document.getElementById("f-activo").checked = !!g.activo;
  document.getElementById("game-form-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteGame(id, rowEl) {
  if (!confirm("¿Eliminar este juego? Esta acción no se puede deshacer.")) return;
  const res = await apiFetch(`/games/${id}`, { method: "DELETE" });
  if (res?.ok) {
    rowEl.remove();
    toast("Juego eliminado");
  } else {
    const err = await res?.json();
    toast(err?.error || "Error al eliminar", true);
  }
}

function bindForm() {
  document.getElementById("game-form").addEventListener("submit", async e => {
    e.preventDefault();
    const body = {
      nombre:      document.getElementById("f-nombre").value.trim(),
      imagen:      document.getElementById("f-imagen").value.trim(),
      descripcion: document.getElementById("f-descripcion").value.trim(),
      servidor:    document.getElementById("f-servidor").value.trim(),
      url:         document.getElementById("f-url").value.trim(),
      guild:       document.getElementById("f-guild").checked,
      serie:       document.getElementById("f-serie").checked,
      activo:      document.getElementById("f-activo").checked,
    };
    if (!body.nombre) return toast("El nombre es requerido", true);

    const isEdit = !!editingId;
    const res = await apiFetch(
      isEdit ? `/games/${editingId}` : "/games",
      { method: isEdit ? "PUT" : "POST", body: JSON.stringify(body) }
    );
    if (res?.ok) {
      toast(isEdit ? "Juego actualizado" : "Juego creado");
      resetForm();
      await loadGames();
    } else {
      const err = await res?.json();
      toast(err?.error || "Error al guardar", true);
    }
  });
}

function resetForm() {
  editingId = null;
  document.getElementById("form-title").textContent = "Nuevo juego";
  document.getElementById("game-form").reset();
  document.getElementById("f-id").value = "";
  document.getElementById("f-activo").checked = true;
}

function toast(msg, isError = false) {
  const el = document.getElementById("admin-toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show${isError ? " error" : ""}`;
  setTimeout(() => el.className = "", 3000);
}
