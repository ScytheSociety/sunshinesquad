// Admin — Gestión de Imágenes
import { getUser, apiFetch } from "../auth.js";

const API_BASE = "https://sunshinesquad.es/api";
let selectedFile = null;

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
  if (badge) badge.textContent = { admin:"Admin", moderador:"Moderador", editor:"Editor" }[user.role] || user.role;

  await loadGallery();
  bindUpload();
  bindModal();

  document.getElementById("filter-cat").addEventListener("change", loadGallery);
  document.getElementById("btn-refresh").addEventListener("click", loadGallery);
});

// ── Galería ──────────────────────────────────────────────────────────────
async function loadGallery() {
  const galleryEl = document.getElementById("gallery");
  galleryEl.innerHTML = `<div class="admin-loading">Cargando...</div>`;

  const cat = document.getElementById("filter-cat").value;
  const res = await apiFetch(`/images${cat ? `?categoria=${cat}` : ""}`);
  if (!res?.ok) { galleryEl.innerHTML = `<div class="admin-empty">Error al cargar imágenes</div>`; return; }

  const images = await res.json();
  updateStats(images);
  renderGallery(images);
}

function renderGallery(images) {
  const galleryEl = document.getElementById("gallery");
  if (!images.length) {
    galleryEl.innerHTML = `<div class="admin-empty">No hay imágenes en esta categoría</div>`;
    return;
  }

  galleryEl.innerHTML = `<div class="img-gallery"></div>`;
  const grid = galleryEl.querySelector(".img-gallery");

  images.forEach(img => {
    const url = `${API_BASE}/images/file/${img.filename}`;
    const kb  = (img.size / 1024).toFixed(0);
    const card = document.createElement("div");
    card.className = "img-card";
    card.innerHTML = `
      <img src="${url}" alt="${img.originalname}" loading="lazy" onerror="this.style.minHeight='60px';">
      <div class="img-card-info">
        <div class="img-card-name" title="${img.originalname}">${img.originalname}</div>
        <div class="img-card-meta">${kb} KB · <span class="cat-badge">${img.categoria}</span></div>
      </div>
      <div class="img-card-actions">
        <button class="btn btn-sm btn-outline-secondary btn-copy" data-url="${url}" data-img="${url}">Copiar URL</button>
        <button class="btn btn-sm btn-outline-danger btn-del" data-filename="${img.filename}">Eliminar</button>
      </div>`;
    grid.appendChild(card);
  });

  grid.querySelectorAll(".btn-copy").forEach(b =>
    b.addEventListener("click", e => { e.stopPropagation(); openModal(b.dataset.url, b.dataset.img); })
  );
  grid.querySelectorAll(".btn-del").forEach(b =>
    b.addEventListener("click", e => { e.stopPropagation(); deleteImage(b.dataset.filename, b.closest(".img-card")); })
  );
  // Click en la tarjeta también abre el modal
  grid.querySelectorAll(".img-card").forEach(card => {
    card.addEventListener("click", () => {
      const url = card.querySelector(".btn-copy").dataset.url;
      openModal(url, url);
    });
  });
}

function updateStats(images) {
  const statsEl = document.getElementById("upload-stats");
  const total = images.length;
  const totalKb = images.reduce((s, i) => s + i.size, 0) / 1024;
  const byCat = {};
  images.forEach(i => byCat[i.categoria] = (byCat[i.categoria] || 0) + 1);
  const catStr = Object.entries(byCat).map(([k,v]) => `${k}: ${v}`).join(" · ") || "—";
  statsEl.innerHTML = `
    <div style="margin-bottom:.3rem;"><span style="color:#a5b4fc;font-weight:700;">${total}</span> imágenes · <span style="color:#a5b4fc;font-weight:700;">${(totalKb/1024).toFixed(2)} MB</span></div>
    <div style="font-size:.75rem;">${catStr}</div>`;
}

async function deleteImage(filename, cardEl) {
  if (!confirm("¿Eliminar esta imagen? No se puede deshacer.")) return;
  const res = await apiFetch(`/images/${filename}`, { method: "DELETE" });
  if (res?.ok) { cardEl.remove(); toast("Imagen eliminada"); await loadGallery(); }
  else { const err = await res?.json(); toast(err?.error || "Error al eliminar", true); }
}

// ── Upload ───────────────────────────────────────────────────────────────
function bindUpload() {
  const zone      = document.getElementById("upload-zone");
  const input     = document.getElementById("file-input");
  const btnUpload = document.getElementById("btn-upload");

  // Click en la zona abre el selector
  zone.addEventListener("click", () => input.click());

  // Drag & drop
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });

  input.addEventListener("change", () => {
    if (input.files[0]) setFile(input.files[0]);
  });

  btnUpload.addEventListener("click", uploadFile);
}

function setFile(file) {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) { toast("Solo se aceptan imágenes (jpg, png, webp, gif)", true); return; }
  if (file.size > 5 * 1024 * 1024) { toast("La imagen supera los 5 MB", true); return; }

  selectedFile = file;
  document.getElementById("upload-icon").textContent = "🖼️";
  document.getElementById("upload-text").textContent = file.name;
  document.getElementById("btn-upload").disabled = false;

  // Preview
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById("preview-img").src = e.target.result;
    document.getElementById("preview-name").textContent = `${file.name} · ${(file.size/1024).toFixed(0)} KB`;
    document.getElementById("upload-preview").style.display = "block";
  };
  reader.readAsDataURL(file);
}

async function uploadFile() {
  if (!selectedFile) return;
  const token = localStorage.getItem("ss_token");
  if (!token) { toast("No autenticado", true); return; }

  const cat     = document.getElementById("upload-cat").value;
  const formData = new FormData();
  formData.append("imagen", selectedFile);
  formData.append("categoria", cat);

  // Mostrar progreso
  document.getElementById("upload-progress").style.display = "block";
  document.getElementById("btn-upload").disabled = true;

  try {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/images/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        document.getElementById("progress-fill").style.width = pct + "%";
        document.getElementById("progress-text").textContent = `Subiendo... ${pct}%`;
      }
    };

    xhr.onload = async () => {
      document.getElementById("upload-progress").style.display = "none";
      if (xhr.status === 201) {
        const data = JSON.parse(xhr.responseText);
        toast(`Imagen subida: ${data.filename}`);
        resetUpload();
        await loadGallery();
        // Abrir el modal con la URL de la nueva imagen
        openModal(`${API_BASE}/images/file/${data.filename}`, `${API_BASE}/images/file/${data.filename}`);
      } else {
        const err = JSON.parse(xhr.responseText);
        toast(err.error || "Error al subir", true);
        document.getElementById("btn-upload").disabled = false;
      }
    };
    xhr.onerror = () => {
      document.getElementById("upload-progress").style.display = "none";
      toast("Error de conexión", true);
      document.getElementById("btn-upload").disabled = false;
    };

    xhr.send(formData);
  } catch (e) {
    toast(e.message, true);
    document.getElementById("btn-upload").disabled = false;
  }
}

function resetUpload() {
  selectedFile = null;
  document.getElementById("upload-icon").textContent = "📁";
  document.getElementById("upload-text").textContent = "Arrastra una imagen o haz clic";
  document.getElementById("upload-preview").style.display = "none";
  document.getElementById("btn-upload").disabled = true;
  document.getElementById("file-input").value = "";
  document.getElementById("progress-fill").style.width = "0%";
}

// ── Modal URL ────────────────────────────────────────────────────────────
function bindModal() {
  document.getElementById("btn-close-modal").addEventListener("click", closeModal);
  document.getElementById("copy-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("copy-modal")) closeModal();
  });
  document.getElementById("btn-copy-url").addEventListener("click", () => {
    const url = document.getElementById("modal-url").textContent;
    navigator.clipboard.writeText(url).then(() => toast("URL copiada al portapapeles"));
  });
}

function openModal(url, imgUrl) {
  document.getElementById("modal-url").textContent = url;
  document.getElementById("modal-img").src = imgUrl;
  const modal = document.getElementById("copy-modal");
  modal.style.display = "flex";
}

function closeModal() {
  document.getElementById("copy-modal").style.display = "none";
}

// ── Toast ────────────────────────────────────────────────────────────────
function toast(msg, isError = false) {
  const el = document.getElementById("admin-toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show${isError ? " error" : ""}`;
  setTimeout(() => el.className = "", 3500);
}
