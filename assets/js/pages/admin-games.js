// Admin — Gestión de Juegos
import { getUser, apiFetch } from "../auth.js";

const API = "https://sunshinesquad.es/api";
let editingId  = null;
let allGames   = [];
let botGames   = [];

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

  await Promise.all([loadGames(), loadBotGames()]);
  bindForm();
  bindImagePreview();

  document.getElementById("btn-new-game").addEventListener("click", () => resetForm());
  document.getElementById("btn-cancel-game").addEventListener("click", () => resetForm());
});

async function loadBotGames() {
  try {
    const res = await fetch(`${API}/games/bot-games`);
    if (!res.ok) return;
    botGames = await res.json();
    populateBotDropdown(null);
  } catch {}
}

function populateBotDropdown(selectedKey) {
  const sel = document.getElementById("f-bot-key");
  if (!sel) return;
  sel.innerHTML = `<option value="">— Sin vincular —</option>`;
  botGames.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.command_key;
    opt.textContent = `${g.emoji} ${g.name} (${g.command_key})`;
    if (g.command_key === selectedKey) opt.selected = true;
    sel.appendChild(opt);
  });
}

async function loadGames() {
  const el = document.getElementById("games-list");
  el.innerHTML = `<div class="admin-loading">Cargando...</div>`;
  const res = await apiFetch("/games");
  if (!res?.ok) { el.innerHTML = `<div class="admin-empty">Error al cargar juegos</div>`; return; }
  allGames = await res.json();
  // Sort by name
  allGames.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  renderGames(allGames);
}

function renderGames(games) {
  const el = document.getElementById("games-list");
  if (!games.length) { el.innerHTML = `<div class="admin-empty">Sin juegos registrados</div>`; return; }

  el.innerHTML = `<div class="admin-rows" id="games-rows"></div>`;
  const rows = document.getElementById("games-rows");
  const user = getUser();

  games.forEach(g => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.dataset.id = g.id;

    const imgSrc = g.imagen
      ? (g.imagen.startsWith("http") || g.imagen.startsWith("/") ? g.imagen : "../../" + g.imagen)
      : null;
    const badges = [g.guild?"GUILD":"", g.serie?"SERIE":"", g.sss?"SSS":"", !g.activo?"INACTIVO":"",
                    g.mostrar_en_carrusel===0?"sin carrusel":"", g.mostrar_en_juegos===0?"oculto en /juegos":""]
      .filter(Boolean).join(" · ") || "Sin badges";

    row.innerHTML = `
      <div class="admin-row-icon" style="background:rgba(99,102,241,.12);color:#a5b4fc;width:42px;height:42px;flex-shrink:0;">
        ${imgSrc ? `<img src="${imgSrc}" style="width:42px;height:42px;object-fit:cover;border-radius:6px;" onerror="this.parentNode.textContent='🎮'">` : "🎮"}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="admin-row-name" style="font-size:.85rem;">${g.nombre}</div>
        <div class="admin-row-meta" style="font-size:.7rem;">${badges}</div>
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-sm btn-outline-secondary btn-edit-game" data-id="${g.id}" style="font-size:.7rem;padding:.2rem .5rem;">Editar</button>
        ${user?.role === "admin" ? `<button class="btn btn-sm btn-outline-danger btn-delete-game" data-id="${g.id}" style="font-size:.7rem;padding:.2rem .5rem;">✕</button>` : ""}
      </div>`;
    rows.appendChild(row);
  });

  rows.querySelectorAll(".btn-edit-game").forEach(b =>
    b.addEventListener("click", () => editGame(parseInt(b.dataset.id)))
  );
  rows.querySelectorAll(".btn-delete-game").forEach(b =>
    b.addEventListener("click", () => deleteGame(parseInt(b.dataset.id), b.closest(".admin-row")))
  );
}

function editGame(id) {
  const g = allGames.find(x => x.id === id);
  if (!g) return;
  editingId = id;
  document.getElementById("form-title").textContent = "Editar juego";
  document.getElementById("f-id").value          = g.id;
  document.getElementById("f-nombre").value       = g.nombre;
  document.getElementById("f-imagen").value       = g.imagen || "";
  document.getElementById("f-descripcion").value  = g.descripcion || "";
  document.getElementById("f-servidor").value     = g.servidor || "";
  document.getElementById("f-url").value          = g.url || "";
  document.getElementById("f-guild").checked      = !!g.guild;
  document.getElementById("f-serie").checked      = !!g.serie;
  document.getElementById("f-sss").checked        = !!g.sss;
  document.getElementById("f-activo").checked     = !!g.activo;
  document.getElementById("f-carrusel").checked   = g.mostrar_en_carrusel !== 0;
  document.getElementById("f-en-juegos").checked  = g.mostrar_en_juegos !== 0;
  populateBotDropdown(g.bot_command_key || g.command_key || null);
  document.getElementById("game-form-card").scrollIntoView({ behavior: "smooth", block: "start" });

  // Trigger image preview
  document.getElementById("f-imagen").dispatchEvent(new Event("input"));
}

async function deleteGame(id, rowEl) {
  if (!confirm("¿Eliminar este juego? Esta acción no se puede deshacer.")) return;
  const res = await apiFetch(`/games/${id}`, { method: "DELETE" });
  if (res?.ok) {
    rowEl.remove();
    allGames = allGames.filter(g => g.id !== id);
    toast("Juego eliminado");
  } else {
    const err = await res?.json().catch(() => ({}));
    toast(err?.error || "Error al eliminar", true);
  }
}

function bindForm() {
  document.getElementById("game-form").addEventListener("submit", async e => {
    e.preventDefault();
    const body = {
      nombre:              document.getElementById("f-nombre").value.trim(),
      imagen:              document.getElementById("f-imagen").value.trim(),
      descripcion:         document.getElementById("f-descripcion").value.trim(),
      servidor:            document.getElementById("f-servidor").value.trim(),
      url:                 document.getElementById("f-url").value.trim(),
      guild:               document.getElementById("f-guild").checked,
      serie:               document.getElementById("f-serie").checked,
      sss:                 document.getElementById("f-sss").checked,
      activo:              document.getElementById("f-activo").checked,
      mostrar_en_carrusel: document.getElementById("f-carrusel").checked,
      mostrar_en_juegos:   document.getElementById("f-en-juegos").checked,
      bot_command_key:     document.getElementById("f-bot-key").value || null,
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
      const err = await res?.json().catch(() => ({}));
      toast(err?.error || "Error al guardar", true);
    }
  });
}

function bindImagePreview() {
  const input = document.getElementById("f-imagen");
  input.addEventListener("input", () => {
    const val = input.value.trim();
    const previewWrap = document.getElementById("f-imagen-preview");
    const previewImg  = document.getElementById("img-preview-el");
    if (val) {
      const src = val.startsWith("http") || val.startsWith("/") ? val : `../../${val}`;
      previewImg.src = src;
      previewWrap.style.display = "block";
      previewImg.onerror = () => previewWrap.style.display = "none";
    } else {
      previewWrap.style.display = "none";
    }
  });
}

function resetForm() {
  editingId = null;
  document.getElementById("form-title").textContent = "Nuevo juego";
  document.getElementById("game-form").reset();
  document.getElementById("f-id").value = "";
  document.getElementById("f-activo").checked    = true;
  document.getElementById("f-carrusel").checked  = true;
  document.getElementById("f-en-juegos").checked = true;
  document.getElementById("f-imagen-preview").style.display = "none";
  populateBotDropdown(null);
}

function toast(msg, isError = false) {
  const el = document.getElementById("admin-toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show${isError ? " error" : ""}`;
  setTimeout(() => el.className = "", 3000);
}
