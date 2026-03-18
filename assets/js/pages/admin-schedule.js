// Admin — Gestión de Horario
import { getUser, apiFetch } from "../auth.js";

let editingId = null;
let allEvents = [];

function slugify(text) {
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 30);
}

function generateId(nombre, juego) {
  const n = slugify(nombre || "evento");
  const j = slugify(juego || "");
  const base = j ? `${n}-${j}` : n;
  return base.substring(0, 35);
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = getUser();
  if (!user || !["admin","moderador"].includes(user.role)) {
    document.getElementById("access-denied").style.display = "block";
    document.getElementById("admin-content").style.display = "none";
    const badge = document.getElementById("admin-role-badge");
    if (badge) badge.textContent = user ? "Sin permisos" : "No autenticado";
    return;
  }
  document.getElementById("admin-content").style.display = "block";
  const badge = document.getElementById("admin-role-badge");
  if (badge) badge.textContent = { admin:"Admin", moderador:"Moderador" }[user.role] || user.role;

  await loadEvents();
  await loadGamesSelect();
  bindForm();

  document.getElementById("btn-new-ev").addEventListener("click", () => resetForm());
  document.getElementById("btn-cancel-ev").addEventListener("click", () => resetForm());
});

async function loadGamesSelect() {
  try {
    const res = await apiFetch("/games");
    if (!res?.ok) return;
    const games = await res.json();
    const sel = document.getElementById("f-juego");
    games.filter(g => g.activo !== 0).forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.nombre;
      opt.textContent = `${g.emoji || "🎮"} ${g.nombre}`;
      sel.appendChild(opt);
    });
  } catch {}
}

async function loadEvents() {
  const el = document.getElementById("events-list");
  el.innerHTML = `<div class="admin-loading">Cargando...</div>`;
  const res = await apiFetch("/schedule/all");
  if (!res?.ok) { el.innerHTML = `<div class="admin-empty">Error al cargar eventos</div>`; return; }
  const data = await res.json();
  allEvents = data.eventos || [];
  renderEvents(allEvents, data.actividades || {});
}

function renderEvents(eventos, actividades) {
  const el = document.getElementById("events-list");
  if (!eventos.length) { el.innerHTML = `<div class="admin-empty">Sin eventos registrados</div>`; return; }

  el.innerHTML = `<div class="admin-rows"></div>`;
  const rows = el.querySelector(".admin-rows");

  eventos.forEach(ev => {
    const act = actividades[ev.id] || {};
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div class="ev-row-status ${ev.activo ? "active" : "inactive"}"></div>
      <div style="flex:1;min-width:0;">
        <div class="admin-row-name">${ev.evento}</div>
        <div class="admin-row-meta">${ev.juego} · ${ev.fecha || "Sin fecha"} ${ev.hora} · ${ev.duracion}h · ${ev.timezone}</div>
        ${act.descripcion ? `<div class="admin-row-meta" style="margin-top:2px;font-style:italic;">${act.descripcion.substring(0,70)}${act.descripcion.length>70?"…":""}</div>` : ""}
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-sm btn-outline-secondary btn-edit-ev" data-id="${ev.id}">Editar</button>
        <button class="btn btn-sm btn-outline-danger btn-del-ev" data-id="${ev.id}">✕</button>
      </div>`;
    rows.appendChild(row);
  });

  rows.querySelectorAll(".btn-edit-ev").forEach(b =>
    b.addEventListener("click", () => editEvent(b.dataset.id, actividades))
  );
  rows.querySelectorAll(".btn-del-ev").forEach(b =>
    b.addEventListener("click", () => deleteEvent(b.dataset.id, b.closest(".admin-row")))
  );
}

function editEvent(id, actividades) {
  const ev = allEvents.find(e => e.id === id);
  if (!ev) return;
  const act = actividades[id] || {};
  editingId = id;
  document.getElementById("form-title").textContent = "Editar evento";
  document.getElementById("f-editing").value = id;
  document.getElementById("f-id").value = ev.id;
  document.getElementById("f-evento").value = ev.evento;
  document.getElementById("f-juego").value = ev.juego;
  document.getElementById("f-duracion").value = ev.duracion;
  document.getElementById("f-fecha").value = ev.fecha || "";
  document.getElementById("f-hora").value = ev.hora;
  document.getElementById("f-timezone").value = ev.timezone || "UTC";
  document.getElementById("f-activo").checked = !!ev.activo;
  document.getElementById("f-descripcion").value = act.descripcion || "";
  document.getElementById("event-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteEvent(id, rowEl) {
  if (!confirm(`¿Eliminar el evento "${id}"?`)) return;
  const res = await apiFetch(`/schedule/${id}`, { method: "DELETE" });
  if (res?.ok) { rowEl.remove(); allEvents = allEvents.filter(e => e.id !== id); toast("Evento eliminado"); }
  else { const err = await res?.json(); toast(err?.error || "Error al eliminar", true); }
}

function bindForm() {
  document.getElementById("event-form").addEventListener("submit", async e => {
    e.preventDefault();
    const isEdit = !!editingId;
    const nombre = document.getElementById("f-evento").value.trim();
    const juego  = document.getElementById("f-juego").value.trim();
    const id     = isEdit ? editingId : generateId(nombre, juego);

    const body = {
      hora:    document.getElementById("f-hora").value,
      juego,
      evento:  nombre,
      duracion: parseFloat(document.getElementById("f-duracion").value) || 2,
      fecha:   document.getElementById("f-fecha").value || null,
      timezone: document.getElementById("f-timezone").value,
      activo:  document.getElementById("f-activo").checked,
      actividad: {
        descripcion: document.getElementById("f-descripcion").value.trim(),
        nivel_minimo: "",
        link_info: "#",
        link_registro: "#",
        clases: [],
        items_requeridos: [],
        consumibles: [],
      },
    };
    if (!isEdit) body.id = id;

    const res = await apiFetch(
      isEdit ? `/schedule/${editingId}` : "/schedule",
      { method: isEdit ? "PUT" : "POST", body: JSON.stringify(body) }
    );
    if (res?.ok) {
      toast(isEdit ? "Evento actualizado" : "Evento creado", false, true);
      resetForm();
      await loadEvents();
    } else {
      const err = await res?.json();
      // Si hay conflicto de ID, añadir sufijo numérico
      if (!isEdit && err?.error?.includes("Ya existe")) {
        body.id = id + "-" + Date.now().toString(36).slice(-4);
        const res2 = await apiFetch("/schedule", { method:"POST", body: JSON.stringify(body) });
        if (res2?.ok) { toast("Evento creado", false, true); resetForm(); await loadEvents(); return; }
      }
      toast(err?.error || "Error al guardar", true);
    }
  });
}

function resetForm() {
  editingId = null;
  document.getElementById("form-title").textContent = "Nuevo evento";
  document.getElementById("event-form").reset();
  document.getElementById("f-id").value = "";
  document.getElementById("f-editing").value = "";
  document.getElementById("f-activo").checked = true;
}

function toast(msg, isError = false, isSuccess = false) {
  const el = document.getElementById("admin-toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show${isError ? " error" : isSuccess ? " success" : ""}`;
  setTimeout(() => el.className = "", 3000);
}
