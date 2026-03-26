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

  document.getElementById("btn-new-game").addEventListener("click", () => resetForm());
  document.getElementById("btn-cancel-game").addEventListener("click", () => resetForm());
  document.getElementById("btn-volver").addEventListener("click", () => closeSecciones());
});

// ── Bot games ────────────────────────────────────────────────────────
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

// ── Juegos list ──────────────────────────────────────────────────────
async function loadGames() {
  const el = document.getElementById("games-list");
  el.innerHTML = `<div class="admin-loading">Cargando...</div>`;
  const res = await apiFetch("/games?_t=" + Date.now());
  if (!res?.ok) { el.innerHTML = `<div class="admin-empty">Error al cargar juegos</div>`; return; }
  allGames = await res.json();
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
    const badges = [g.guild?"GUILD":"", g.serie?"SERIE":"", g.sss?"SSS":"", !g.activo?"INACTIVO":""]
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
        <button class="btn btn-sm btn-outline-primary btn-secciones-game" data-id="${g.id}" style="font-size:.7rem;padding:.2rem .5rem;">Secciones</button>
        ${user?.role === "admin" ? `<button class="btn btn-sm btn-outline-danger btn-delete-game" data-id="${g.id}" style="font-size:.7rem;padding:.2rem .5rem;">✕</button>` : ""}
      </div>`;
    rows.appendChild(row);
  });

  rows.querySelectorAll(".btn-edit-game").forEach(b =>
    b.addEventListener("click", () => editGame(parseInt(b.dataset.id)))
  );
  rows.querySelectorAll(".btn-secciones-game").forEach(b =>
    b.addEventListener("click", () => openSecciones(parseInt(b.dataset.id)).catch(() => {}))
  );
  rows.querySelectorAll(".btn-delete-game").forEach(b =>
    b.addEventListener("click", () => deleteGame(parseInt(b.dataset.id), b.closest(".admin-row")))
  );
}

function editGame(id) {
  const g = allGames.find(x => x.id === id);
  if (!g) return;
  editingId = id;
  document.getElementById("generate-page-wrap").style.display = "none";
  document.getElementById("form-title").textContent = "Editar juego";
  document.getElementById("f-id").value          = g.id;
  document.getElementById("f-nombre").value       = g.nombre;
  document.getElementById("f-descripcion").value  = g.descripcion || "";
  document.getElementById("f-servidor").value     = g.servidor || "";
  document.getElementById("f-url").value          = g.url || "";
  document.getElementById("f-guild").checked      = !!g.guild;
  document.getElementById("f-serie").checked      = !!g.serie;
  document.getElementById("f-sss").checked        = !!g.sss;
  document.getElementById("f-activo").checked     = !!g.activo;
  populateBotDropdown(g.bot_command_key || g.command_key || null);
  document.getElementById("game-form-card").scrollIntoView({ behavior: "smooth", block: "start" });
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
    const isEdit = !!editingId;
    const body = {
      nombre:          document.getElementById("f-nombre").value.trim(),
      descripcion:     document.getElementById("f-descripcion").value.trim(),
      servidor:        document.getElementById("f-servidor").value.trim(),
      url:             document.getElementById("f-url").value.trim(),
      guild:           document.getElementById("f-guild").checked,
      serie:           document.getElementById("f-serie").checked,
      sss:             document.getElementById("f-sss").checked,
      activo:          document.getElementById("f-activo").checked,
      bot_command_key: document.getElementById("f-bot-key").value || null,
    };
    if (!isEdit) {
      body.generate_page = document.getElementById("f-generate-page").checked;
    }
    if (!body.nombre) return toast("El nombre es requerido", true);

    const res = await apiFetch(
      isEdit ? `/games/${editingId}` : "/games",
      { method: isEdit ? "PUT" : "POST", body: JSON.stringify(body) }
    );
    if (res?.ok) {
      const data = await res.json();
      if (data.generated) {
        toast(`Juego creado ✓ — Página generada: ${data.generated.pageUrl} (haz git push para publicar)`);
      } else {
        toast(isEdit ? "Juego actualizado" : "Juego creado");
      }
      resetForm();
      await loadGames();
    } else {
      const err = await res?.json().catch(() => ({}));
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
  document.getElementById("generate-page-wrap").style.display = "block";
  document.getElementById("f-generate-page").checked = false;
  populateBotDropdown(null);
}

// ── Secciones (drill-down) ───────────────────────────────────────────
let secGameKey     = null;
let secTipo        = null;
let secSecciones   = [];   // array of {id, tipo, label, emoji} from API
let secSearchTimer = null;

async function openSecciones(gameId) {
  const g = allGames.find(x => x.id === gameId);
  if (!g) return;

  const urlKey = g.url?.match(/juegos\/([^/]+)\//)?.[1];
  if (!urlKey) {
    toast("Este juego no tiene una página generada aún.", true);
    return;
  }

  secGameKey = urlKey;

  document.getElementById("sec-game-title").textContent = `Secciones — ${g.nombre}`;

  const searchEl = document.getElementById("sec-search");
  searchEl.value = "";
  searchEl.oninput = () => {
    clearTimeout(secSearchTimer);
    secSearchTimer = setTimeout(() => loadSecPosts(), 350);
  };

  document.getElementById("games-view").style.display = "none";
  document.getElementById("secciones-view").style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });

  await loadSecSections();
}

function closeSecciones() {
  document.getElementById("secciones-view").style.display = "none";
  document.getElementById("games-view").style.display = "block";
  secGameKey = null;
  secSecciones = [];
}

async function loadSecSections() {
  try {
    const res = await apiFetch(`/content/sections?game_key=${secGameKey}`);
    if (!res?.ok) throw new Error();
    secSecciones = await res.json();
  } catch {
    secSecciones = [{ tipo:"guia", label:"Guías", emoji:"📖" }, { tipo:"build", label:"Builds", emoji:"🔧" }];
  }
  if (!secTipo || !secSecciones.find(s => s.tipo === secTipo)) {
    secTipo = secSecciones[0]?.tipo || "guia";
  }
  renderSecTabs();
  loadSecPosts();
}

function renderSecTabs() {
  const container = document.getElementById("sec-tabs");
  container.innerHTML = "";
  const user = getUser();

  secSecciones.forEach(s => {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:inline-flex;align-items:center;gap:2px;";

    const btn = document.createElement("button");
    btn.className = "mm-tab-btn" + (s.tipo === secTipo ? " active" : "");
    btn.textContent = `${s.emoji ? s.emoji + " " : ""}${s.label}`;
    btn.addEventListener("click", () => {
      secTipo = s.tipo;
      container.querySelectorAll(".mm-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("sec-search").value = "";
      updateSecNewBtn();
      loadSecPosts();
    });
    wrap.appendChild(btn);

    // Edit / delete buttons for editors
    if (user?.role === "editor" || user?.role === "moderador" || user?.role === "admin") {
      const editBtn = document.createElement("button");
      editBtn.title = "Renombrar sección";
      editBtn.style.cssText = "background:none;border:none;color:rgba(255,255,255,.3);font-size:.72rem;cursor:pointer;padding:0 3px;line-height:1;";
      editBtn.textContent = "✏️";
      editBtn.addEventListener("click", e => { e.stopPropagation(); openEditSection(s); });
      wrap.appendChild(editBtn);
    }
    if (user?.role === "admin" && s.id) {
      const delBtn = document.createElement("button");
      delBtn.title = "Eliminar sección";
      delBtn.style.cssText = "background:none;border:none;color:rgba(239,68,68,.4);font-size:.72rem;cursor:pointer;padding:0 3px;line-height:1;";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", e => { e.stopPropagation(); deleteSection(s); });
      wrap.appendChild(delBtn);
    }

    container.appendChild(wrap);
  });

  // "+ Nueva sección" button
  const addBtn = document.createElement("button");
  addBtn.className = "mm-tab-btn";
  addBtn.style.cssText = "border-style:dashed;opacity:.6;";
  addBtn.textContent = "+ Sección";
  addBtn.addEventListener("click", () => openNewSection());
  container.appendChild(addBtn);

  updateSecNewBtn();
}

function updateSecNewBtn() {
  const btn = document.getElementById("btn-new-sec");
  if (!btn || !secGameKey || !secTipo) return;
  const sec = secSecciones.find(s => s.tipo === secTipo);
  btn.href = `../../pages/guia/editor.html?game=${secGameKey}&tipo=${secTipo}`;
  btn.textContent = `+ Nueva ${sec?.label || secTipo}`;
}

// ── Section create/edit modal ────────────────────────────────────────
function openNewSection() {
  showSectionModal(null);
}

function openEditSection(sec) {
  showSectionModal(sec);
}

function showSectionModal(sec) {
  const existing = document.getElementById("sec-modal");
  if (existing) existing.remove();

  const isEdit = !!sec?.id;
  const modal = document.createElement("div");
  modal.id = "sec-modal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px);";
  modal.innerHTML = `
    <div style="background:#0d1117;border:1px solid rgba(255,255,255,.13);border-radius:16px;padding:1.5rem;max-width:380px;width:100%;">
      <div style="font-weight:700;font-size:.95rem;margin-bottom:1.2rem;">${isEdit ? "Editar sección" : "Nueva sección"}</div>
      ${!isEdit ? `
      <div class="mb-3">
        <label class="admin-label">Tipo (identificador único)</label>
        <input type="text" id="sec-modal-tipo" class="form-control"
          placeholder="pvp, woe, mvp…" value="">
        <div style="font-size:.7rem;color:rgba(255,255,255,.3);margin-top:.25rem;">Sin espacios, solo letras y guiones. No se puede cambiar después.</div>
      </div>` : ""}
      <div class="mb-3">
        <label class="admin-label">Nombre visible</label>
        <input type="text" id="sec-modal-label" class="form-control" placeholder="PvP, WoE…" value="${sec?.label || ""}">
      </div>
      <div class="mb-3">
        <label class="admin-label">Emoji (opcional)</label>
        <input type="text" id="sec-modal-emoji" class="form-control" placeholder="⚔️" value="${sec?.emoji || ""}">
      </div>
      <div class="d-flex gap-2 mt-3">
        <button id="sec-modal-save" class="btn-indigo flex-fill">${isEdit ? "Guardar" : "Crear"}</button>
        <button id="sec-modal-cancel" class="btn-ss flex-fill">Cancelar</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelector("#sec-modal-cancel").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });

  modal.querySelector("#sec-modal-save").addEventListener("click", async () => {
    const label = modal.querySelector("#sec-modal-label").value.trim();
    const emoji = modal.querySelector("#sec-modal-emoji").value.trim();
    if (!label) return toast("El nombre es requerido", true);

    if (isEdit) {
      const res = await apiFetch(`/content/sections/${sec.id}`, {
        method: "PUT", body: JSON.stringify({ label, emoji })
      });
      if (res?.ok) { modal.remove(); toast("Sección actualizada"); await loadSecSections(); }
      else { const e = await res?.json().catch(()=>({})); toast(e?.error || "Error", true); }
    } else {
      const tipo = modal.querySelector("#sec-modal-tipo").value.trim().toLowerCase().replace(/\s+/g,"-");
      if (!tipo) return toast("El tipo es requerido", true);
      const res = await apiFetch("/content/sections", {
        method: "POST", body: JSON.stringify({ game_key: secGameKey, tipo, label, emoji })
      });
      if (res?.ok) {
        modal.remove();
        toast("Sección creada");
        secTipo = tipo;
        await loadSecSections();
      } else { const e = await res?.json().catch(()=>({})); toast(e?.error || "Error", true); }
    }
  });
}

async function deleteSection(sec) {
  if (!confirm(`¿Eliminar la sección "${sec.label}"? Se eliminarán TODAS sus publicaciones.`)) return;
  const res = await apiFetch(`/content/sections/${sec.id}`, { method: "DELETE" });
  if (res?.ok) {
    toast("Sección eliminada");
    if (secTipo === sec.tipo) secTipo = null;
    await loadSecSections();
  } else {
    const e = await res?.json().catch(()=>({}));
    toast(e?.error || "Error al eliminar", true);
  }
}

// ── Posts list ───────────────────────────────────────────────────────
async function loadSecPosts() {
  const el = document.getElementById("sec-posts-list");
  if (!secGameKey) return;
  el.innerHTML = `<div class="admin-loading">Cargando…</div>`;

  const q = document.getElementById("sec-search").value.trim();
  let url = `/content?game_key=${secGameKey}&tipo=${secTipo}`;
  if (q) url += `&q=${encodeURIComponent(q)}`;

  try {
    const res = await apiFetch(url);
    if (!res?.ok) throw new Error();
    const data = await res.json();
    renderSecPosts(data.posts || []);
  } catch {
    el.innerHTML = `<div class="admin-empty">Error al cargar publicaciones.</div>`;
  }
}

function renderSecPosts(posts) {
  const el = document.getElementById("sec-posts-list");
  if (!posts.length) {
    el.innerHTML = `<div class="admin-empty">Sin publicaciones en esta sección. ¡Crea la primera!</div>`;
    return;
  }

  el.innerHTML = posts.map(p => {
    const fecha = new Date(p.created_at).toLocaleDateString("es", { day:"2-digit", month:"short", year:"numeric" });
    const draft = !p.publicado
      ? `<span style="font-size:.6rem;font-weight:700;padding:.1rem .35rem;border-radius:4px;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.3);color:#fde047;margin-left:.4rem;">Borrador</span>`
      : "";
    const ratingHtml = p.rating
      ? `<span style="font-size:.65rem;color:rgba(255,255,255,.35);">⭐ ${p.rating} (${p.votos})</span>`
      : "";
    return `
      <div class="admin-row" style="align-items:center;gap:10px;" data-post-id="${p.id}">
        <div style="flex:1;min-width:0;">
          <div class="admin-row-name" style="font-size:.85rem;">${p.titulo}${draft}</div>
          <div class="admin-row-meta" style="font-size:.68rem;display:flex;gap:.5rem;align-items:center;">
            <span>${p.autor_nombre} · ${fecha}</span>
            ${ratingHtml}
          </div>
        </div>
        <div class="admin-row-actions d-flex gap-1 flex-shrink-0">
          <a href="../../pages/guia/editor.html?game=${secGameKey}&slug=${p.slug}"
             class="btn btn-sm btn-outline-secondary" style="font-size:.7rem;padding:.2rem .5rem;">Editar</a>
          <button class="btn btn-sm btn-outline-danger btn-del-sec-post" data-id="${p.id}" style="font-size:.7rem;padding:.2rem .5rem;">✕</button>
        </div>
      </div>`;
  }).join("");

  el.querySelectorAll(".btn-del-sec-post").forEach(btn =>
    btn.addEventListener("click", () => deleteSecPost(parseInt(btn.dataset.id), btn.closest(".admin-row")))
  );
}

async function deleteSecPost(id, rowEl) {
  if (!confirm("¿Eliminar esta publicación? Se borrarán también sus comentarios y valoraciones.")) return;
  const res = await apiFetch(`/content/${id}`, { method: "DELETE" });
  if (res?.ok) {
    rowEl.remove();
    toast("Publicación eliminada");
    if (!document.querySelectorAll("#sec-posts-list .admin-row").length) {
      document.getElementById("sec-posts-list").innerHTML = `<div class="admin-empty">Sin publicaciones en esta sección.</div>`;
    }
  } else {
    const err = await res?.json().catch(() => ({}));
    toast(err?.error || "Error al eliminar", true);
  }
}

// ── Toast ────────────────────────────────────────────────────────────
function toast(msg, isError = false) {
  const el = document.getElementById("admin-toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show${isError ? " error" : ""}`;
  setTimeout(() => el.className = "", 3500);
}
