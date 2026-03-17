// Admin — Gestión de Horario
import { getUser, apiFetch } from "../auth.js";

let editingId = null;
let allEvents = [];

document.addEventListener("DOMContentLoaded", async () => {
  const user = getUser();
  if (!user || !["admin","moderador"].includes(user.role)) {
    document.getElementById("access-denied").style.display = "block";
    document.getElementById("admin-content").style.display = "none";
    const badge = document.getElementById("admin-role-badge");
    if (badge) badge.textContent = user ? (["editor"].includes(user.role) ? "Solo Moderador/Admin" : "Sin permisos") : "No autenticado";
    return;
  }
  document.getElementById("admin-content").style.display = "block";
  const badge = document.getElementById("admin-role-badge");
  if (badge) badge.textContent = { admin:"Admin", moderador:"Moderador" }[user.role] || user.role;

  await loadEvents();
  await loadGamesDatalist();
  bindForm();

  document.getElementById("btn-new-ev").addEventListener("click", () => resetForm());
  document.getElementById("btn-cancel-ev").addEventListener("click", () => resetForm());
});

async function loadGamesDatalist() {
  try {
    const res = await apiFetch("/games");
    if (!res?.ok) return;
    const games = await res.json();
    const dl = document.getElementById("juegos-list");
    games.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.nombre;
      dl.appendChild(opt);
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
      <div style="flex:1;min-width:0;">
        <div class="admin-row-name" style="font-size:.82rem;">${ev.evento}</div>
        <div class="admin-row-meta" style="font-size:.7rem;">${ev.juego} · ${ev.fecha||"Sin fecha"} ${ev.hora} · ${ev.duracion}h · ${ev.timezone}${ev.activo?"":" · INACTIVO"}</div>
        ${act.descripcion ? `<div class="admin-row-meta" style="font-size:.68rem;margin-top:2px;">${act.descripcion.substring(0,60)}${act.descripcion.length>60?"...":""}</div>` : ""}
      </div>
      <div class="admin-row-actions">
        <button class="btn btn-sm btn-outline-secondary btn-edit-ev" data-id="${ev.id}" style="font-size:.7rem;padding:.2rem .5rem;">Editar</button>
        <button class="btn btn-sm btn-outline-danger btn-del-ev" data-id="${ev.id}" style="font-size:.7rem;padding:.2rem .5rem;">✕</button>
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
  document.getElementById("f-id").disabled = true;
  document.getElementById("f-evento").value = ev.evento;
  document.getElementById("f-juego").value = ev.juego;
  document.getElementById("f-duracion").value = ev.duracion;
  document.getElementById("f-fecha").value = ev.fecha || "";
  document.getElementById("f-hora").value = ev.hora;
  document.getElementById("f-timezone").value = ev.timezone || "UTC";
  document.getElementById("f-activo").checked = !!ev.activo;
  document.getElementById("f-descripcion").value = act.descripcion || "";
  document.getElementById("f-nivel").value = act.nivel_minimo || "";
  document.getElementById("f-link-info").value = act.link_info !== "#" ? (act.link_info || "") : "";
  document.getElementById("f-clases").value = (act.clases || []).join(", ");
  document.getElementById("f-items").value = (act.items_requeridos || []).join(", ");
  document.getElementById("f-consumibles").value = (act.consumibles || []).join(", ");
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
    const id = isEdit ? editingId : document.getElementById("f-id").value.trim();

    const splitCSV = v => v.split(",").map(x => x.trim()).filter(Boolean);
    const linkInfo = document.getElementById("f-link-info").value.trim();

    const body = {
      hora:    document.getElementById("f-hora").value,
      juego:   document.getElementById("f-juego").value.trim(),
      evento:  document.getElementById("f-evento").value.trim(),
      duracion: parseFloat(document.getElementById("f-duracion").value) || 2,
      fecha:   document.getElementById("f-fecha").value || null,
      timezone: document.getElementById("f-timezone").value,
      activo:  document.getElementById("f-activo").checked,
      actividad: {
        descripcion:       document.getElementById("f-descripcion").value.trim(),
        nivel_minimo:      document.getElementById("f-nivel").value.trim(),
        link_info:         linkInfo || "#",
        link_registro:     "#",
        clases:            splitCSV(document.getElementById("f-clases").value),
        items_requeridos:  splitCSV(document.getElementById("f-items").value),
        consumibles:       splitCSV(document.getElementById("f-consumibles").value),
      },
    };
    if (!isEdit) body.id = id;

    const res = await apiFetch(
      isEdit ? `/schedule/${editingId}` : "/schedule",
      { method: isEdit ? "PUT" : "POST", body: JSON.stringify(body) }
    );
    if (res?.ok) {
      toast(isEdit ? "Evento actualizado" : "Evento creado");
      resetForm();
      await loadEvents();
    } else {
      const err = await res?.json();
      toast(err?.error || "Error al guardar", true);
    }
  });
}

function resetForm() {
  editingId = null;
  document.getElementById("form-title").textContent = "Nuevo evento";
  document.getElementById("event-form").reset();
  document.getElementById("f-id").disabled = false;
  document.getElementById("f-editing").value = "";
  document.getElementById("f-activo").checked = true;
}

function toast(msg, isError = false) {
  const el = document.getElementById("admin-toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show${isError ? " error" : ""}`;
  setTimeout(() => el.className = "", 3000);
}
