// Admin — Gestión de Streams
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

  await loadStreams();
  bindForm();

  document.getElementById("btn-new-stream").addEventListener("click", () => resetForm());
  document.getElementById("btn-cancel-stream").addEventListener("click", () => resetForm());

  // Preview en tiempo real
  const chInput = document.getElementById("f-channel");
  chInput.addEventListener("input", () => updatePreview(chInput.value.trim()));
});

function updatePreview(channel) {
  const preview = document.getElementById("stream-preview");
  const link = document.getElementById("preview-link");
  const text = document.getElementById("preview-text");
  if (channel) {
    preview.style.display = "block";
    link.href = `https://twitch.tv/${channel}`;
    text.textContent = `twitch.tv/${channel}`;
  } else {
    preview.style.display = "none";
  }
}

async function loadStreams() {
  const el = document.getElementById("streams-list");
  el.innerHTML = `<div class="admin-loading">Cargando...</div>`;
  const res = await apiFetch("/streams");
  if (!res?.ok) { el.innerHTML = `<div class="admin-empty">Error al cargar canales</div>`; return; }
  const data = await res.json();
  renderStreams(data.channels || []);
}

function renderStreams(channels) {
  const el = document.getElementById("streams-list");
  if (!channels.length) { el.innerHTML = `<div class="admin-empty">Sin canales registrados</div>`; return; }

  el.innerHTML = `<div class="admin-rows"></div>`;
  const rows = el.querySelector(".admin-rows");

  channels.forEach(s => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.dataset.id = s.id;
    row.innerHTML = `
      <div class="admin-row-icon" style="background:rgba(145,71,255,.12);color:#c4b5fd;font-size:1.1rem;width:38px;height:38px;">📺</div>
      <div style="flex:1;min-width:0;">
        <div class="admin-row-name">${s.name}</div>
        <div class="admin-row-meta">twitch.tv/${s.channel}${s.activo ? "" : " · INACTIVO"}</div>
      </div>
      <div class="admin-row-actions">
        <a href="https://twitch.tv/${s.channel}" target="_blank" class="btn btn-sm btn-outline-secondary" style="font-size:.7rem;padding:.2rem .5rem;" title="Ver canal">↗</a>
        <button class="btn btn-sm btn-outline-secondary btn-edit-s" data-id="${s.id}" style="font-size:.7rem;padding:.2rem .5rem;">Editar</button>
        <button class="btn btn-sm btn-outline-danger btn-del-s" data-id="${s.id}" style="font-size:.7rem;padding:.2rem .5rem;">✕</button>
      </div>`;
    rows.appendChild(row);
  });

  rows.querySelectorAll(".btn-edit-s").forEach(b =>
    b.addEventListener("click", () => editStream(parseInt(b.dataset.id), channels))
  );
  rows.querySelectorAll(".btn-del-s").forEach(b =>
    b.addEventListener("click", () => deleteStream(parseInt(b.dataset.id), b.closest(".admin-row")))
  );
}

function editStream(id, channels) {
  const s = channels.find(x => x.id === id);
  if (!s) return;
  editingId = id;
  document.getElementById("form-title").textContent = "Editar canal";
  document.getElementById("f-id").value = s.id;
  document.getElementById("f-name").value = s.name;
  document.getElementById("f-channel").value = s.channel;
  document.getElementById("f-activo").checked = !!s.activo;
  updatePreview(s.channel);
}

async function deleteStream(id, rowEl) {
  if (!confirm("¿Eliminar este canal?")) return;
  const res = await apiFetch(`/streams/${id}`, { method: "DELETE" });
  if (res?.ok) { rowEl.remove(); toast("Canal eliminado"); }
  else { const err = await res?.json(); toast(err?.error || "Error al eliminar", true); }
}

function bindForm() {
  document.getElementById("stream-form").addEventListener("submit", async e => {
    e.preventDefault();
    const isEdit = !!editingId;
    const body = {
      name:    document.getElementById("f-name").value.trim(),
      channel: document.getElementById("f-channel").value.trim(),
      activo:  document.getElementById("f-activo").checked,
    };
    if (!body.name || !body.channel) return toast("Nombre y canal son requeridos", true);

    const res = await apiFetch(
      isEdit ? `/streams/${editingId}` : "/streams",
      { method: isEdit ? "PUT" : "POST", body: JSON.stringify(body) }
    );
    if (res?.ok) {
      toast(isEdit ? "Canal actualizado" : "Canal agregado");
      resetForm();
      await loadStreams();
    } else {
      const err = await res?.json();
      toast(err?.error || "Error al guardar", true);
    }
  });
}

function resetForm() {
  editingId = null;
  document.getElementById("form-title").textContent = "Agregar canal";
  document.getElementById("stream-form").reset();
  document.getElementById("f-id").value = "";
  document.getElementById("f-activo").checked = true;
  document.getElementById("stream-preview").style.display = "none";
}

function toast(msg, isError = false) {
  const el = document.getElementById("admin-toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show${isError ? " error" : ""}`;
  setTimeout(() => el.className = "", 3000);
}
