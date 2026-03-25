// Admin — Multimedia por Juego
import { getUser, apiFetch } from "../auth.js";

const API = "https://sunshinesquad.es/api";

let currentGame  = null;
let mediaData    = { gallery: [], videos: [], servidor: null };
let editingImgId = null;
let editingVidId = null;

// ── Auth ────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const user = getUser();
  if (!user || !["admin","moderador","editor"].includes(user.role)) {
    document.getElementById("access-denied").style.display = "block";
    document.getElementById("admin-content").style.display  = "none";
    return;
  }
  document.getElementById("admin-content").style.display = "block";
  const badge = document.getElementById("admin-role-badge");
  if (badge) badge.textContent = { admin:"Admin", moderador:"Moderador", editor:"Editor" }[user.role] || user.role;

  await loadGameSelector();
  bindTabs();
  bindImgForm();
  bindVidForm();
  bindServerForm();

  document.getElementById("btn-load-game").addEventListener("click", () => {
    const key = document.getElementById("sel-game").value;
    if (!key) return toast("Selecciona un juego", true);
    loadGame(key);
  });
});

// ── Game selector ───────────────────────────────────────────────────
async function loadGameSelector() {
  try {
    const res = await fetch(`${API}/games?_t=` + Date.now());
    if (!res.ok) return;
    const games = await res.json();
    const sel   = document.getElementById("sel-game");
    games.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
    games.forEach(g => {
      // Determine game key: prefer bot_command_key, then command_key, then derive from nombre
      // Extraer key de URL (ej. "pages/juegos/ragnarok/..." → "ragnarok") para coincidir con data-game
      const urlMatch = g.url?.match(/juegos\/([^/]+)\//);
      const key = urlMatch ? urlMatch[1] : (g.bot_command_key || g.command_key || g.nombre.toLowerCase().replace(/\s+/g, ""));
      const opt  = document.createElement("option");
      opt.value  = key;
      opt.textContent = g.nombre;
      sel.appendChild(opt);
    });
  } catch {}
}

// ── Load game media ─────────────────────────────────────────────────
async function loadGame(key) {
  currentGame = key;
  try {
    const res = await fetch(`${API}/game-media/${key}`);
    mediaData = res.ok ? await res.json() : { gallery: [], videos: [], servidor: null };
  } catch {
    mediaData = { gallery: [], videos: [], servidor: null };
  }
  document.getElementById("editor-wrap").style.display = "block";
  renderGallery();
  renderVideos();
  populateServerForm();
}

// ── Tabs ────────────────────────────────────────────────────────────
function bindTabs() {
  document.querySelectorAll(".mm-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mm-tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".mm-tab-content").forEach(t => t.style.display = "none");
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).style.display = "block";
    });
  });
}

// ── Gallery ─────────────────────────────────────────────────────────
function renderGallery() {
  const el = document.getElementById("gallery-list");
  if (!mediaData.gallery.length) {
    el.innerHTML = `<div class="admin-empty">Sin imágenes aún.</div>`;
    return;
  }
  el.innerHTML = "";
  mediaData.gallery.forEach(img => {
    const row = document.createElement("div");
    row.className = "mm-media-row";
    row.dataset.id = img.id;
    row.innerHTML = `
      <img class="mm-media-thumb" src="${img.url}" alt="${img.titulo||""}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="mm-media-thumb-empty" style="display:none;">📷</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:.82rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${img.titulo || "(sin título)"}</div>
        <div style="font-size:.68rem;color:rgba(255,255,255,.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${img.url}</div>
      </div>
      <button class="btn btn-sm btn-outline-secondary btn-edit-img" data-id="${img.id}" style="font-size:.7rem;padding:.2rem .5rem;flex-shrink:0;">Editar</button>
      <button class="btn btn-sm btn-outline-danger btn-del-img" data-id="${img.id}" style="font-size:.7rem;padding:.2rem .5rem;flex-shrink:0;">✕</button>
    `;
    el.appendChild(row);
  });
  el.querySelectorAll(".btn-edit-img").forEach(b =>
    b.addEventListener("click", () => editImg(parseInt(b.dataset.id)))
  );
  el.querySelectorAll(".btn-del-img").forEach(b =>
    b.addEventListener("click", () => deleteImg(parseInt(b.dataset.id), b.closest(".mm-media-row")))
  );
}

function bindImgForm() {
  document.getElementById("btn-add-img").addEventListener("click", () => {
    editingImgId = null;
    document.getElementById("img-form-title").textContent = "Nueva imagen";
    document.getElementById("img-url").value   = "";
    document.getElementById("img-titulo").value = "";
    document.getElementById("img-preview").style.display = "none";
    document.getElementById("img-form").style.display = "block";
  });

  document.getElementById("img-url").addEventListener("input", () => {
    const val = document.getElementById("img-url").value.trim();
    const wrap = document.getElementById("img-preview");
    const img  = document.getElementById("img-preview-el");
    if (val) { img.src = val; wrap.style.display = "block"; img.onerror = () => wrap.style.display = "none"; }
    else wrap.style.display = "none";
  });

  document.getElementById("btn-cancel-img").addEventListener("click", () => {
    document.getElementById("img-form").style.display = "none";
    editingImgId = null;
  });

  document.getElementById("btn-save-img").addEventListener("click", async () => {
    const url    = document.getElementById("img-url").value.trim();
    const titulo = document.getElementById("img-titulo").value.trim();
    if (!url) return toast("La URL es requerida", true);

    let res;
    if (editingImgId) {
      res = await apiFetch(`/game-media/${currentGame}/gallery/${editingImgId}`, {
        method: "PUT", body: JSON.stringify({ url, titulo }),
      });
    } else {
      res = await apiFetch(`/game-media/${currentGame}/gallery`, {
        method: "POST", body: JSON.stringify({ url, titulo }),
      });
    }

    if (res?.ok) {
      toast(editingImgId ? "Imagen actualizada" : "Imagen añadida");
      document.getElementById("img-form").style.display = "none";
      editingImgId = null;
      await loadGame(currentGame);
    } else {
      const err = await res?.json().catch(() => ({}));
      toast(err?.error || "Error al guardar", true);
    }
  });
}

function editImg(id) {
  const img = mediaData.gallery.find(g => g.id === id);
  if (!img) return;
  editingImgId = id;
  document.getElementById("img-form-title").textContent = "Editar imagen";
  document.getElementById("img-url").value   = img.url;
  document.getElementById("img-titulo").value = img.titulo || "";
  document.getElementById("img-form").style.display = "block";
  document.getElementById("img-url").dispatchEvent(new Event("input"));
}

async function deleteImg(id, rowEl) {
  if (!confirm("¿Eliminar esta imagen?")) return;
  const res = await apiFetch(`/game-media/${currentGame}/gallery/${id}`, { method: "DELETE" });
  if (res?.ok) {
    rowEl.remove();
    mediaData.gallery = mediaData.gallery.filter(g => g.id !== id);
    if (!mediaData.gallery.length) document.getElementById("gallery-list").innerHTML = `<div class="admin-empty">Sin imágenes aún.</div>`;
    toast("Imagen eliminada");
  } else { toast("Error al eliminar", true); }
}

// ── Videos ──────────────────────────────────────────────────────────
function renderVideos() {
  const el = document.getElementById("videos-list");
  if (!mediaData.videos.length) {
    el.innerHTML = `<div class="admin-empty">Sin videos aún.</div>`;
    return;
  }
  el.innerHTML = "";
  mediaData.videos.forEach(v => {
    const row = document.createElement("div");
    row.className = "mm-media-row";
    row.dataset.id = v.id;

    // Try to get YouTube thumbnail
    const ytMatch = v.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
    const thumb   = ytMatch ? `<img class="mm-media-thumb" src="https://img.youtube.com/vi/${ytMatch[1]}/default.jpg" alt="">` : `<div class="mm-media-thumb-empty">▶️</div>`;

    row.innerHTML = `
      ${thumb}
      <div style="flex:1;min-width:0;">
        <div style="font-size:.82rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.titulo || "(sin título)"}</div>
        <div style="font-size:.68rem;color:rgba(255,255,255,.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.url}</div>
      </div>
      <button class="btn btn-sm btn-outline-secondary btn-edit-vid" data-id="${v.id}" style="font-size:.7rem;padding:.2rem .5rem;flex-shrink:0;">Editar</button>
      <button class="btn btn-sm btn-outline-danger btn-del-vid" data-id="${v.id}" style="font-size:.7rem;padding:.2rem .5rem;flex-shrink:0;">✕</button>
    `;
    el.appendChild(row);
  });
  el.querySelectorAll(".btn-edit-vid").forEach(b =>
    b.addEventListener("click", () => editVid(parseInt(b.dataset.id)))
  );
  el.querySelectorAll(".btn-del-vid").forEach(b =>
    b.addEventListener("click", () => deleteVid(parseInt(b.dataset.id), b.closest(".mm-media-row")))
  );
}

function bindVidForm() {
  document.getElementById("btn-add-vid").addEventListener("click", () => {
    editingVidId = null;
    document.getElementById("vid-form-title").textContent = "Nuevo video";
    document.getElementById("vid-url").value   = "";
    document.getElementById("vid-titulo").value = "";
    document.getElementById("vid-form").style.display = "block";
  });
  document.getElementById("btn-cancel-vid").addEventListener("click", () => {
    document.getElementById("vid-form").style.display = "none";
    editingVidId = null;
  });
  document.getElementById("btn-save-vid").addEventListener("click", async () => {
    const url    = document.getElementById("vid-url").value.trim();
    const titulo = document.getElementById("vid-titulo").value.trim();
    if (!url) return toast("La URL es requerida", true);

    let res;
    if (editingVidId) {
      res = await apiFetch(`/game-media/${currentGame}/videos/${editingVidId}`, {
        method: "PUT", body: JSON.stringify({ url, titulo }),
      });
    } else {
      res = await apiFetch(`/game-media/${currentGame}/videos`, {
        method: "POST", body: JSON.stringify({ url, titulo }),
      });
    }

    if (res?.ok) {
      toast(editingVidId ? "Video actualizado" : "Video añadido");
      document.getElementById("vid-form").style.display = "none";
      editingVidId = null;
      await loadGame(currentGame);
    } else {
      const err = await res?.json().catch(() => ({}));
      toast(err?.error || "Error al guardar", true);
    }
  });
}

function editVid(id) {
  const v = mediaData.videos.find(x => x.id === id);
  if (!v) return;
  editingVidId = id;
  document.getElementById("vid-form-title").textContent = "Editar video";
  document.getElementById("vid-url").value   = v.url;
  document.getElementById("vid-titulo").value = v.titulo || "";
  document.getElementById("vid-form").style.display = "block";
}

async function deleteVid(id, rowEl) {
  if (!confirm("¿Eliminar este video?")) return;
  const res = await apiFetch(`/game-media/${currentGame}/videos/${id}`, { method: "DELETE" });
  if (res?.ok) {
    rowEl.remove();
    mediaData.videos = mediaData.videos.filter(v => v.id !== id);
    if (!mediaData.videos.length) document.getElementById("videos-list").innerHTML = `<div class="admin-empty">Sin videos aún.</div>`;
    toast("Video eliminado");
  } else { toast("Error al eliminar", true); }
}

// ── Server config ────────────────────────────────────────────────────
function populateServerForm() {
  const s = mediaData.servidor || {};
  document.getElementById("srv-logo").value     = s.logo_url    || "";
  document.getElementById("srv-web").value      = s.web         || "";
  document.getElementById("srv-wiki").value     = s.wiki        || "";
  document.getElementById("srv-descarga").value = s.descarga    || "";
  document.getElementById("srv-discord").value  = s.discord     || "";
  document.getElementById("srv-desc").value     = s.descripcion || "";
  renderInfoRows(s.info || []);

  // Logo preview
  const logo = document.getElementById("srv-logo").value.trim();
  const wrap = document.getElementById("srv-logo-preview");
  const img  = document.getElementById("srv-logo-img");
  if (logo) { img.src = logo; wrap.style.display = "block"; } else wrap.style.display = "none";
}

document.getElementById?.("srv-logo")?.addEventListener?.("input", function() {
  // handled after DOMContentLoaded
});

function renderInfoRows(rows) {
  const el = document.getElementById("srv-info-rows");
  el.innerHTML = "";
  rows.forEach(r => addInfoRow(r.label, r.valor));
}

function addInfoRow(label = "", valor = "") {
  const el = document.getElementById("srv-info-rows");
  const row = document.createElement("div");
  row.className = "srv-info-row";
  row.innerHTML = `
    <input type="text" class="form-control srv-info-label" placeholder="Etiqueta" value="${label}" style="max-width:180px;">
    <input type="text" class="form-control srv-info-valor" placeholder="Valor" value="${valor}" style="flex:1;">
    <button class="btn btn-sm btn-outline-danger btn-del-info-row" style="font-size:.7rem;padding:.2rem .5rem;flex-shrink:0;">✕</button>
  `;
  row.querySelector(".btn-del-info-row").addEventListener("click", () => row.remove());
  el.appendChild(row);
}

function bindServerForm() {
  // Logo preview on input
  document.getElementById("srv-logo").addEventListener("input", function() {
    const val  = this.value.trim();
    const wrap = document.getElementById("srv-logo-preview");
    const img  = document.getElementById("srv-logo-img");
    if (val) { img.src = val; wrap.style.display = "block"; img.onerror = () => wrap.style.display = "none"; }
    else wrap.style.display = "none";
  });

  document.getElementById("btn-add-info-row").addEventListener("click", () => addInfoRow());

  document.getElementById("server-form").addEventListener("submit", async e => {
    e.preventDefault();
    const info = [...document.querySelectorAll(".srv-info-row")].map(row => ({
      label: row.querySelector(".srv-info-label").value.trim(),
      valor: row.querySelector(".srv-info-valor").value.trim(),
    })).filter(r => r.label);

    const body = {
      logo_url:    document.getElementById("srv-logo").value.trim(),
      descripcion: document.getElementById("srv-desc").value.trim(),
      web:         document.getElementById("srv-web").value.trim(),
      wiki:        document.getElementById("srv-wiki").value.trim(),
      descarga:    document.getElementById("srv-descarga").value.trim(),
      discord:     document.getElementById("srv-discord").value.trim(),
      info,
    };

    const res = await apiFetch(`/game-media/${currentGame}/server`, {
      method: "PUT", body: JSON.stringify(body),
    });

    if (res?.ok) {
      toast("Configuración guardada");
      await loadGame(currentGame);
    } else {
      const err = await res?.json().catch(() => ({}));
      toast(err?.error || "Error al guardar", true);
    }
  });
}

// ── Toast ────────────────────────────────────────────────────────────
function toast(msg, isError = false) {
  const el = document.getElementById("admin-toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show${isError ? " error" : ""}`;
  setTimeout(() => el.className = "", 3000);
}
