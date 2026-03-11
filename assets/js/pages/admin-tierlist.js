// Admin — Catálogo Tier List
import { getUser } from "../auth.js";

const API = "https://sunshinesquad.es/api";

// Defaults para seed por juego
const DEFAULTS = {
  ragnarok: {
    items: [
      { name:"Lord Knight",     image_url:"https://file5s.ratemyserver.net/skill_chars/j4008_m_stand.gif", image_url_f:"https://file5s.ratemyserver.net/skill_chars/j4008_f_stand.gif", category:"general" },
      { name:"Paladin",         image_url:"https://file5s.ratemyserver.net/skill_chars/j4015_m_stand.gif", image_url_f:"https://file5s.ratemyserver.net/skill_chars/j4015_f_stand.gif", category:"general" },
      { name:"High Wizard",     image_url:"https://file5s.ratemyserver.net/skill_chars/j4010_m_stand.gif", image_url_f:"https://file5s.ratemyserver.net/skill_chars/j4010_f_stand.gif", category:"general" },
      { name:"Sniper",          image_url:"https://file5s.ratemyserver.net/skill_chars/j4012_m_stand.gif", image_url_f:"https://file5s.ratemyserver.net/skill_chars/j4012_f_stand.gif", category:"general" },
      { name:"High Priest",     image_url:"https://file5s.ratemyserver.net/skill_chars/j4009_m_stand.gif", image_url_f:"https://file5s.ratemyserver.net/skill_chars/j4009_f_stand.gif", category:"general" },
      { name:"Champion",        image_url:"https://file5s.ratemyserver.net/skill_chars/j4016_m_stand.gif", image_url_f:"https://file5s.ratemyserver.net/skill_chars/j4016_f_stand.gif", category:"general" },
      { name:"Whitesmith",      image_url:"https://file5s.ratemyserver.net/skill_chars/j4011_m_stand.gif", image_url_f:"https://file5s.ratemyserver.net/skill_chars/j4011_f_stand.gif", category:"general" },
      { name:"Creator",         image_url:"https://file5s.ratemyserver.net/skill_chars/j4019_m_stand.gif", image_url_f:"https://file5s.ratemyserver.net/skill_chars/j4019_f_stand.gif", category:"general" },
      { name:"Assassin Cross",  image_url:"https://file5s.ratemyserver.net/skill_chars/j4013_m_stand.gif", image_url_f:"https://file5s.ratemyserver.net/skill_chars/j4013_f_stand.gif", category:"general" },
      { name:"Clown",           image_url:"https://file5s.ratemyserver.net/skill_chars/j4020_m_stand.gif", image_url_f:null, category:"general" },
      { name:"Gypsy",           image_url:"https://file5s.ratemyserver.net/skill_chars/j4021_f_stand.gif", image_url_f:null, category:"general" },
      { name:"Professor",       image_url:"https://file5s.ratemyserver.net/skill_chars/j4014_m_stand.gif", image_url_f:"https://file5s.ratemyserver.net/skill_chars/j4014_f_stand.gif", category:"general" },
      { name:"Stalker",         image_url:"https://file5s.ratemyserver.net/skill_chars/j4017_m_stand.gif", image_url_f:"https://file5s.ratemyserver.net/skill_chars/j4017_f_stand.gif", category:"general" },
      { name:"Biochemist",      image_url:"https://file5s.ratemyserver.net/skill_chars/j4019_m_stand.gif", image_url_f:"https://file5s.ratemyserver.net/skill_chars/j4019_f_stand.gif", category:"general" },
    ],
    roles: [
      { role_name:"Tank",    icon:"🛡️", color:"#3b82f6" },
      { role_name:"Healer",  icon:"💚", color:"#22c55e" },
      { role_name:"Support", icon:"✨", color:"#eab308" },
      { role_name:"DPS",     icon:"⚔️", color:"#ef4444" },
    ],
    skills: [],
  },
  wow: {
    items: [
      { name:"Paladin",      image_url:"https://wow.zamimg.com/images/wow/icons/medium/class_paladin.jpg",      category:"general" },
      { name:"Death Knight", image_url:"https://wow.zamimg.com/images/wow/icons/medium/class_deathknight.jpg", category:"general" },
      { name:"Druid",        image_url:"https://wow.zamimg.com/images/wow/icons/medium/class_druid.jpg",       category:"general" },
      { name:"Warrior",      image_url:"https://wow.zamimg.com/images/wow/icons/medium/class_warrior.jpg",     category:"general" },
      { name:"Hunter",       image_url:"https://wow.zamimg.com/images/wow/icons/medium/class_hunter.jpg",      category:"general" },
      { name:"Priest",       image_url:"https://wow.zamimg.com/images/wow/icons/medium/class_priest.jpg",      category:"general" },
      { name:"Warlock",      image_url:"https://wow.zamimg.com/images/wow/icons/medium/class_warlock.jpg",     category:"general" },
      { name:"Mage",         image_url:"https://wow.zamimg.com/images/wow/icons/medium/class_mage.jpg",        category:"general" },
      { name:"Rogue",        image_url:"https://wow.zamimg.com/images/wow/icons/medium/class_rogue.jpg",       category:"general" },
      { name:"Shaman",       image_url:"https://wow.zamimg.com/images/wow/icons/medium/class_shaman.jpg",      category:"general" },
      { name:"Monk",         image_url:"https://wow.zamimg.com/images/wow/icons/medium/class_monk.jpg",        category:"general" },
      { name:"Demon Hunter", image_url:"https://wow.zamimg.com/images/wow/icons/medium/class_demonhunter.jpg", category:"general" },
      { name:"Evoker",       image_url:"https://wow.zamimg.com/images/wow/icons/medium/class_evoker.jpg",      category:"general" },
    ],
    roles: [
      { role_name:"Tank",   icon:"🛡️", color:"#3b82f6" },
      { role_name:"Healer", icon:"💚", color:"#22c55e" },
      { role_name:"DPS",    icon:"⚔️", color:"#ef4444" },
    ],
    skills: [],
  },
  lineage2: {
    items: [
      { name:"Tank",       category:"general" },
      { name:"Healer",     category:"general" },
      { name:"DD Mage",    category:"general" },
      { name:"DD Físico",  category:"general" },
      { name:"Buffer",     category:"general" },
      { name:"Archer",     category:"general" },
      { name:"Summoner",   category:"general" },
      { name:"Nuker",      category:"general" },
    ],
    roles: [
      { role_name:"Tank",    icon:"🛡️", color:"#3b82f6" },
      { role_name:"Healer",  icon:"💚", color:"#22c55e" },
      { role_name:"Buffer",  icon:"✨", color:"#eab308" },
      { role_name:"DD",      icon:"⚔️", color:"#ef4444" },
    ],
    skills: [],
  },
  brawlstars: {
    items: ["Shelly","Nita","Colt","Bull","Jessie","Brock","El Primo","Barley","Poco","Rosa","Mortis","El Primo","Piper","Pam","Crow","Leon","Spike"].map(n => ({ name: n, category:"general" })),
    roles: [
      { role_name:"Tank",    icon:"🛡️", color:"#3b82f6" },
      { role_name:"Sniper",  icon:"🎯", color:"#f97316" },
      { role_name:"Support", icon:"💚", color:"#22c55e" },
      { role_name:"Assassin",icon:"⚔️", color:"#ef4444" },
      { role_name:"Thrower", icon:"💥", color:"#8b5cf6" },
    ],
    skills: [],
  },
  throneandliberty: {
    items: [
      { name:"Espada/Escudo",  is_dual_weapon:false, category:"general" },
      { name:"Arco/Daga",      is_dual_weapon:false, category:"general" },
      { name:"Báculo/Libro",   is_dual_weapon:false, category:"general" },
      { name:"Mandoble",       is_dual_weapon:false, category:"general" },
      { name:"Varita/Libro",   is_dual_weapon:false, category:"general" },
      { name:"Arco/Báculo",    is_dual_weapon:false, category:"general" },
    ],
    roles: [
      { role_name:"Tank",    icon:"🛡️", color:"#3b82f6" },
      { role_name:"Healer",  icon:"💚", color:"#22c55e" },
      { role_name:"DPS",     icon:"⚔️", color:"#ef4444" },
      { role_name:"Support", icon:"✨", color:"#eab308" },
    ],
    skills: [],
  },
};

// ── Helpers ────────────────────────────────────────────────────────
const AVATAR_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];
const avatarColor = name => AVATAR_COLORS[(name||"?").charCodeAt(0) % AVATAR_COLORS.length];

let currentGame = "ragnarok";
let editingItem   = null;
let editingRole   = null;
let editingSkill  = null;
let editingTalent = null;
let confirmCb     = null;
let allItems      = [];

function authHeaders() {
  const token = localStorage.getItem("ss_token");
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function toast(msg, error = false) {
  let el = document.getElementById("admin-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "admin-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = "show" + (error ? " error" : "");
  setTimeout(() => el.className = "", 2800);
}

function confirm(title, msg, cb, okLabel = "Confirmar") {
  document.getElementById("confirm-title").textContent  = title;
  document.getElementById("confirm-msg").textContent    = msg;
  document.getElementById("confirm-ok").textContent     = okLabel;
  document.getElementById("confirm-modal").style.display = "flex";
  confirmCb = cb;
}

document.getElementById("confirm-ok")?.addEventListener("click", () => {
  document.getElementById("confirm-modal").style.display = "none";
  confirmCb?.();
});
document.getElementById("confirm-cancel")?.addEventListener("click", () => {
  document.getElementById("confirm-modal").style.display = "none";
});

// ── Tabs ───────────────────────────────────────────────────────────
document.querySelectorAll("#catalog-tabs .nav-link").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#catalog-tabs .nav-link").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    ["items","roles","skills","talents"].forEach(t => {
      document.getElementById(`tab-${t}`).style.display = t === btn.dataset.tab ? "block" : "none";
    });
  });
});

// ── Game selector ──────────────────────────────────────────────────
const GAME_COVERS_DEFAULT = {
  ragnarok:        "../../assets/images/games/ragnarok.jpg",
  wow:             "../../assets/images/games/wow.jpg",
  lineage2:        "../../assets/images/games/lineage2.jpg",
  brawlstars:      "../../assets/images/games/brawlstars.jpg",
  throneandliberty:"../../assets/images/games/throneandliberty.jpg",
};

function setGameCoverImg(src) {
  const img         = document.getElementById("game-cover-img");
  const placeholder = document.getElementById("game-cover-placeholder");
  if (!img || !placeholder) return;
  if (src) {
    img.src = src;
    img.style.display = "block";
    placeholder.style.display = "none";
    img.onerror = () => { img.style.display = "none"; placeholder.style.display = "flex"; };
  } else {
    img.style.display = "none";
    placeholder.style.display = "flex";
  }
}

async function updateGameCover(game) {
  const urlInput = document.getElementById("game-cover-url");
  try {
    const res  = await fetch(`${API}/tl-catalog/${game}/cover`, { headers: authHeaders() });
    const data = await res.json();
    const src  = data.image_url || GAME_COVERS_DEFAULT[game] || null;
    setGameCoverImg(src);
    if (urlInput) urlInput.value = data.image_url || "";
  } catch {
    const src = GAME_COVERS_DEFAULT[game] || null;
    setGameCoverImg(src);
    if (urlInput) urlInput.value = "";
  }
}

document.getElementById("btn-save-cover")?.addEventListener("click", async () => {
  const urlInput = document.getElementById("game-cover-url");
  const src = urlInput?.value?.trim();
  if (!src) { toast("Ingresa una URL válida", true); return; }
  try {
    const res = await fetch(`${API}/tl-catalog/${currentGame}/cover`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ image_url: src }),
    });
    if (!res.ok) throw new Error();
    setGameCoverImg(src);
    toast("Imagen guardada");
  } catch { toast("Error al guardar la imagen", true); }
});

document.getElementById("adm-game")?.addEventListener("change", e => {
  currentGame = e.target.value;
  updateGameCover(currentGame);
  resetForms();
  loadAll();
});

document.getElementById("btn-reload")?.addEventListener("click", loadAll);

document.getElementById("btn-seed-defaults")?.addEventListener("click", () => {
  confirm(
    "Importar defaults",
    `¿Importar datos por defecto para ${currentGame}? No sobreescribirá entradas existentes.`,
    seedDefaults,
    "Importar"
  );
});

async function seedDefaults() {
  const data = DEFAULTS[currentGame];
  if (!data) { toast("No hay defaults para este juego", true); return; }
  try {
    const res = await fetch(`${API}/tl-catalog/${currentGame}/seed`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    const r = await res.json();
    if (!res.ok) throw new Error(r.error || "Error");
    toast(`✓ Importado: ${r.items_added} clases, ${r.roles_added} roles`);
    loadAll();
  } catch(e) { toast(e.message, true); }
}

// ── Load all ───────────────────────────────────────────────────────
async function loadAll() {
  loadItems();
  loadRoles();
  loadSkills();
  loadTalents();
}

// ─────────────────────────────────────────────────────────────────
// ITEMS
// ─────────────────────────────────────────────────────────────────
async function loadItems() {
  document.getElementById("items-list").innerHTML = `<div class="admin-loading">Cargando...</div>`;
  try {
    const res = await fetch(`${API}/tl-catalog/${currentGame}/items`);
    allItems = await res.json();
    renderItems(allItems);
  } catch { document.getElementById("items-list").innerHTML = `<div class="admin-empty">Error al cargar</div>`; }
}

function renderItems(items) {
  const el = document.getElementById("items-list");
  document.getElementById("items-count").textContent = `${items.length} clase${items.length !== 1 ? "s" : ""}`;
  if (!items.length) { el.innerHTML = `<div class="admin-empty">Sin clases. Importa defaults o añade manualmente.</div>`; return; }

  el.innerHTML = "";
  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "admin-item-card";

    const hasImgM = !!item.image_url;
    const hasImgF = !!item.image_url_f;
    const bg = avatarColor(item.name);

    card.innerHTML = `
      <div class="admin-item-imgs">
        ${hasImgM ? `<img src="${item.image_url}" alt="M" loading="lazy" onerror="this.style.display='none'">` :
                    `<div class="admin-item-avatar" style="background:${bg}">${item.name[0].toUpperCase()}</div>`}
        ${hasImgF ? `<img src="${item.image_url_f}" alt="F" loading="lazy" onerror="this.style.display='none'">` : ""}
      </div>
      <div class="admin-item-name">${item.name}</div>
      <div class="admin-item-cat">${item.category}</div>
      <div class="admin-item-actions">
        <button class="btn-ss active" data-edit="${item.id}">✏️ Editar</button>
        <button class="btn-ss" data-del="${item.id}" style="color:#fca5a5;">🗑️ Borrar</button>
      </div>
    `;

    card.querySelector("[data-edit]")?.addEventListener("click", () => editItem(item));
    card.querySelector("[data-del]")?.addEventListener("click", () => {
      confirm("Borrar clase", `¿Eliminar "${item.name}"?`, () => deleteItem(item.id), "Eliminar");
    });
    el.appendChild(card);
  });
}

// Búsqueda
document.getElementById("items-search")?.addEventListener("input", e => {
  const q = e.target.value.trim().toLowerCase();
  renderItems(q ? allItems.filter(i => i.name.toLowerCase().includes(q)) : allItems);
});

// Preview de imágenes
["item-img","item-img-f"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", updateItemPreview);
});

function updateItemPreview() {
  const imgM = document.getElementById("item-img").value.trim();
  const imgF = document.getElementById("item-img-f").value.trim();
  const prev = document.getElementById("item-preview");
  const pM   = document.getElementById("item-preview-img");
  const pF   = document.getElementById("item-preview-imgf");
  if (!prev) return;
  if (imgM || imgF) {
    prev.style.display = "flex";
    pM.src = imgM || "";
    pM.style.display = imgM ? "" : "none";
    pF.src = imgF || "";
    pF.style.display = imgF ? "" : "none";
  } else {
    prev.style.display = "none";
  }
}

function editItem(item) {
  editingItem = item.id;
  document.getElementById("item-form-title").textContent = `Editando: ${item.name}`;
  document.getElementById("item-name").value     = item.name;
  document.getElementById("item-category").value = item.category || "general";
  document.getElementById("item-img").value      = item.image_url  || "";
  document.getElementById("item-img-f").value    = item.image_url_f || "";
  document.getElementById("item-order").value    = item.sort_order ?? 0;
  document.getElementById("item-dual").checked   = !!item.is_dual_weapon;
  document.getElementById("btn-cancel-item").style.display = "";
  document.getElementById("item-name").scrollIntoView({ behavior: "smooth", block: "center" });
  updateItemPreview();
}

function resetItemForm() {
  editingItem = null;
  document.getElementById("item-form-title").textContent = "Añadir clase / ítem";
  document.getElementById("item-name").value = "";
  document.getElementById("item-category").value = "general";
  document.getElementById("item-img").value = "";
  document.getElementById("item-img-f").value = "";
  document.getElementById("item-order").value = 0;
  document.getElementById("item-dual").checked = false;
  document.getElementById("btn-cancel-item").style.display = "none";
  document.getElementById("item-preview").style.display = "none";
}

document.getElementById("btn-cancel-item")?.addEventListener("click", resetItemForm);

document.getElementById("btn-save-item")?.addEventListener("click", async () => {
  const name = document.getElementById("item-name").value.trim();
  if (!name) { toast("El nombre es requerido", true); return; }

  const body = {
    name,
    image_url:      document.getElementById("item-img").value.trim()   || null,
    image_url_f:    document.getElementById("item-img-f").value.trim() || null,
    category:       document.getElementById("item-category").value,
    sort_order:     parseInt(document.getElementById("item-order").value) || 0,
    is_dual_weapon: document.getElementById("item-dual").checked,
  };

  try {
    let res;
    if (editingItem) {
      res = await fetch(`${API}/tl-catalog/items/${editingItem}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
    } else {
      res = await fetch(`${API}/tl-catalog/${currentGame}/items`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    }
    const r = await res.json();
    if (!res.ok) throw new Error(r.error || "Error");
    toast(editingItem ? "✓ Clase actualizada" : "✓ Clase añadida");
    resetItemForm();
    loadItems();
  } catch(e) { toast(e.message, true); }
});

async function deleteItem(id) {
  try {
    const res = await fetch(`${API}/tl-catalog/items/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error("Error al borrar");
    toast("✓ Clase eliminada");
    loadItems();
  } catch(e) { toast(e.message, true); }
}

// ─────────────────────────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────────────────────────
async function loadRoles() {
  document.getElementById("roles-list").innerHTML = `<div class="admin-loading">Cargando...</div>`;
  try {
    const res  = await fetch(`${API}/tl-catalog/${currentGame}/roles`);
    const roles = await res.json();
    renderRoles(roles);
  } catch { document.getElementById("roles-list").innerHTML = `<div class="admin-empty">Error al cargar</div>`; }
}

function renderRoles(roles) {
  const el = document.getElementById("roles-list");
  document.getElementById("roles-count").textContent = `${roles.length} rol${roles.length !== 1 ? "es" : ""}`;
  if (!roles.length) { el.innerHTML = `<div class="admin-empty">Sin roles. Añade roles para este juego.</div>`; return; }
  el.innerHTML = "";
  roles.forEach(r => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div class="admin-row-icon" style="background:${r.color}22;border:1px solid ${r.color}44;">${r.icon||"⚔️"}</div>
      <div class="admin-row-name">${r.role_name}</div>
      <div class="admin-row-meta" style="color:${r.color}">${r.color}</div>
      <div class="admin-row-actions">
        <button class="btn-ss active" data-edit-role="${r.id}">✏️</button>
        <button class="btn-ss" data-del-role="${r.id}" style="color:#fca5a5;">🗑️</button>
      </div>
    `;
    row.querySelector("[data-edit-role]")?.addEventListener("click", () => editRole(r));
    row.querySelector("[data-del-role]")?.addEventListener("click", () => {
      confirm("Borrar rol", `¿Eliminar "${r.role_name}"?`, () => deleteRole(r.id), "Eliminar");
    });
    el.appendChild(row);
  });
}

function editRole(r) {
  editingRole = r.id;
  document.getElementById("role-form-title").textContent = `Editando: ${r.role_name}`;
  document.getElementById("role-name").value  = r.role_name;
  document.getElementById("role-icon").value  = r.icon  || "";
  document.getElementById("role-color").value = r.color || "#6b7280";
  document.getElementById("role-order").value = r.sort_order ?? 0;
  document.getElementById("btn-cancel-role").style.display = "";
}

function resetRoleForm() {
  editingRole = null;
  document.getElementById("role-form-title").textContent = "Añadir rol";
  document.getElementById("role-name").value  = "";
  document.getElementById("role-icon").value  = "";
  document.getElementById("role-color").value = "#3b82f6";
  document.getElementById("role-order").value = 0;
  document.getElementById("btn-cancel-role").style.display = "none";
}

document.getElementById("btn-cancel-role")?.addEventListener("click", resetRoleForm);

document.getElementById("btn-save-role")?.addEventListener("click", async () => {
  const role_name = document.getElementById("role-name").value.trim();
  if (!role_name) { toast("El nombre es requerido", true); return; }
  const body = {
    role_name,
    icon:       document.getElementById("role-icon").value.trim()  || "⚔️",
    color:      document.getElementById("role-color").value,
    sort_order: parseInt(document.getElementById("role-order").value) || 0,
  };
  try {
    let res;
    if (editingRole) {
      res = await fetch(`${API}/tl-catalog/roles/${editingRole}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
    } else {
      res = await fetch(`${API}/tl-catalog/${currentGame}/roles`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    }
    const r = await res.json();
    if (!res.ok) throw new Error(r.error || "Error");
    toast(editingRole ? "✓ Rol actualizado" : "✓ Rol añadido");
    resetRoleForm();
    loadRoles();
  } catch(e) { toast(e.message, true); }
});

async function deleteRole(id) {
  try {
    const res = await fetch(`${API}/tl-catalog/roles/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error("Error al borrar");
    toast("✓ Rol eliminado");
    loadRoles();
  } catch(e) { toast(e.message, true); }
}

// ─────────────────────────────────────────────────────────────────
// SKILLS
// ─────────────────────────────────────────────────────────────────
async function loadSkills() {
  document.getElementById("skills-list").innerHTML = `<div class="admin-loading">Cargando...</div>`;
  try {
    const res    = await fetch(`${API}/tl-catalog/${currentGame}/skills`);
    const skills = await res.json();
    renderSkills(skills);
  } catch { document.getElementById("skills-list").innerHTML = `<div class="admin-empty">Error al cargar</div>`; }
}

function renderSkills(skills) {
  const el = document.getElementById("skills-list");
  document.getElementById("skills-count").textContent = `${skills.length} skill${skills.length !== 1 ? "s" : ""}`;
  if (!skills.length) { el.innerHTML = `<div class="admin-empty">Sin skills. Añade skills para este juego.</div>`; return; }
  el.innerHTML = "";
  skills.forEach(sk => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      ${sk.image_url ? `<img src="${sk.image_url}" class="admin-row-img" loading="lazy">` : `<div class="admin-row-icon" style="background:rgba(255,255,255,.06)">⚡</div>`}
      <div class="admin-row-name">${sk.name}</div>
      <div class="admin-row-actions">
        <button class="btn-ss active" data-edit-sk="${sk.id}">✏️</button>
        <button class="btn-ss" data-del-sk="${sk.id}" style="color:#fca5a5;">🗑️</button>
      </div>
    `;
    row.querySelector("[data-edit-sk]")?.addEventListener("click", () => editSkill(sk));
    row.querySelector("[data-del-sk]")?.addEventListener("click", () => {
      confirm("Borrar skill", `¿Eliminar "${sk.name}"?`, () => deleteSkill(sk.id), "Eliminar");
    });
    el.appendChild(row);
  });
}

function editSkill(sk) {
  editingSkill = sk.id;
  document.getElementById("skill-form-title").textContent = `Editando: ${sk.name}`;
  document.getElementById("skill-name").value  = sk.name;
  document.getElementById("skill-img").value   = sk.image_url  || "";
  document.getElementById("skill-order").value = sk.sort_order ?? 0;
  document.getElementById("btn-cancel-skill").style.display = "";
}

function resetSkillForm() {
  editingSkill = null;
  document.getElementById("skill-form-title").textContent = "Añadir skill";
  document.getElementById("skill-name").value  = "";
  document.getElementById("skill-img").value   = "";
  document.getElementById("skill-order").value = 0;
  document.getElementById("btn-cancel-skill").style.display = "none";
}

document.getElementById("btn-cancel-skill")?.addEventListener("click", resetSkillForm);

document.getElementById("btn-save-skill")?.addEventListener("click", async () => {
  const name = document.getElementById("skill-name").value.trim();
  if (!name) { toast("El nombre es requerido", true); return; }
  const body = {
    name,
    image_url:  document.getElementById("skill-img").value.trim()   || null,
    sort_order: parseInt(document.getElementById("skill-order").value) || 0,
  };
  try {
    let res;
    if (editingSkill) {
      res = await fetch(`${API}/tl-catalog/skills/${editingSkill}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
    } else {
      res = await fetch(`${API}/tl-catalog/${currentGame}/skills`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    }
    const r = await res.json();
    if (!res.ok) throw new Error(r.error || "Error");
    toast(editingSkill ? "✓ Skill actualizado" : "✓ Skill añadido");
    resetSkillForm();
    loadSkills();
  } catch(e) { toast(e.message, true); }
});

async function deleteSkill(id) {
  try {
    const res = await fetch(`${API}/tl-catalog/skills/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error("Error al borrar");
    toast("✓ Skill eliminado");
    loadSkills();
  } catch(e) { toast(e.message, true); }
}

function resetForms() { resetItemForm(); resetRoleForm(); resetSkillForm(); resetTalentForm(); }

// ─────────────────────────────────────────────────────────────────
// TALENTOS
// ─────────────────────────────────────────────────────────────────
async function loadTalents() {
  document.getElementById("talents-list").innerHTML = `<div class="admin-loading">Cargando...</div>`;
  try {
    const res     = await fetch(`${API}/tl-catalog/${currentGame}/talents`);
    const talents = await res.json();
    renderTalents(talents);
  } catch { document.getElementById("talents-list").innerHTML = `<div class="admin-empty">Error al cargar</div>`; }
}

function renderTalents(talents) {
  const el = document.getElementById("talents-list");
  document.getElementById("talents-count").textContent = `${talents.length} talento${talents.length !== 1 ? "s" : ""}`;
  if (!talents.length) { el.innerHTML = `<div class="admin-empty">Sin talentos. Añade talentos para este juego.</div>`; return; }
  el.innerHTML = "";
  talents.forEach(t => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      ${t.image_url ? `<img src="${t.image_url}" class="admin-row-img" loading="lazy">` : `<div class="admin-row-icon" style="background:rgba(255,255,255,.06)">✦</div>`}
      <div class="admin-row-name">${t.name}</div>
      <div class="admin-row-actions">
        <button class="btn-ss active" data-edit-tl="${t.id}">✏️</button>
        <button class="btn-ss" data-del-tl="${t.id}" style="color:#fca5a5;">🗑️</button>
      </div>
    `;
    row.querySelector("[data-edit-tl]")?.addEventListener("click", () => editTalent(t));
    row.querySelector("[data-del-tl]")?.addEventListener("click", () => {
      confirm("Borrar talento", `¿Eliminar "${t.name}"?`, () => deleteTalent(t.id), "Eliminar");
    });
    el.appendChild(row);
  });
}

function editTalent(t) {
  editingTalent = t.id;
  document.getElementById("talent-form-title").textContent = `Editando: ${t.name}`;
  document.getElementById("talent-name").value  = t.name;
  document.getElementById("talent-img").value   = t.image_url  || "";
  document.getElementById("talent-order").value = t.sort_order ?? 0;
  document.getElementById("btn-cancel-talent").style.display = "";
}

function resetTalentForm() {
  editingTalent = null;
  document.getElementById("talent-form-title").textContent = "Añadir talento";
  document.getElementById("talent-name").value  = "";
  document.getElementById("talent-img").value   = "";
  document.getElementById("talent-order").value = 0;
  document.getElementById("btn-cancel-talent").style.display = "none";
}

document.getElementById("btn-cancel-talent")?.addEventListener("click", resetTalentForm);

document.getElementById("btn-save-talent")?.addEventListener("click", async () => {
  const name = document.getElementById("talent-name").value.trim();
  if (!name) { toast("El nombre es requerido", true); return; }
  const body = {
    name,
    image_url:  document.getElementById("talent-img").value.trim()   || null,
    sort_order: parseInt(document.getElementById("talent-order").value) || 0,
  };
  try {
    let res;
    if (editingTalent) {
      res = await fetch(`${API}/tl-catalog/talents/${editingTalent}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
    } else {
      res = await fetch(`${API}/tl-catalog/${currentGame}/talents`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    }
    const r = await res.json();
    if (!res.ok) throw new Error(r.error || "Error");
    toast(editingTalent ? "✓ Talento actualizado" : "✓ Talento añadido");
    resetTalentForm();
    loadTalents();
  } catch(e) { toast(e.message, true); }
});

async function deleteTalent(id) {
  try {
    const res = await fetch(`${API}/tl-catalog/talents/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error("Error al borrar");
    toast("✓ Talento eliminado");
    loadTalents();
  } catch(e) { toast(e.message, true); }
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const user = getUser();
  if (!user || !["admin","moderador","editor"].includes(user.role)) {
    document.querySelector("main").innerHTML = `
      <div class="card-dark text-center py-5">
        <div style="font-size:3rem;">🔒</div>
        <h3 style="color:#ef4444;margin:.75rem 0 .5rem;">Acceso denegado</h3>
        <p class="text-muted-ss">Necesitas ser Editor, Moderador o Admin.</p>
        <a href="index.html" class="btn-ss mt-3" style="display:inline-block;">← Admin</a>
      </div>`;
    return;
  }
  currentGame = document.getElementById("adm-game")?.value || "ragnarok";
  updateGameCover(currentGame);
  loadAll();
});
