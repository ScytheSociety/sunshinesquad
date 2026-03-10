// Tier List Builder — imágenes, roles, skills, variantes M/F, save/share

const API = "https://sunshinesquad.es/api";

const DEFAULT_TIERS = [
  { id: "S", label: "S", color: "#ef4444" },
  { id: "A", label: "A", color: "#f97316" },
  { id: "B", label: "B", color: "#eab308" },
  { id: "C", label: "C", color: "#22c55e" },
  { id: "D", label: "D", color: "#3b82f6" },
  { id: "F", label: "F", color: "#6b7280" },
];

const FALLBACK_ITEMS = {
  ragnarok:        ["Genetic","Sorcerer","Ranger","Rune Knight","Royal Guard","Archbishop","Shadow Chaser","Guillotine Cross","Warlock","Minstrel","Wanderer","Mechanic"],
  wow:             ["Paladin","Death Knight","Druid","Warrior","Hunter","Priest","Warlock","Mage","Rogue","Shaman","Monk","Demon Hunter"],
  lineage2:        ["Tank","Healer","DD Mage","DD Físico","Buffer","Archer","Summoner","Nuker"],
  brawlstars:      ["Shelly","Nita","Colt","Bull","Jessie","Brock","El Primo","Barley","Poco","Rosa","Mortis"],
  throneandliberty:["Espada/Escudo","Arco/Daga","Báculo/Libro","Mandoble","Varita/Libro","Arco/Báculo"],
};

const AVATAR_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f43f5e","#6366f1"];
function avatarColor(name) {
  return AVATAR_COLORS[(name||"?").charCodeAt(0) % AVATAR_COLORS.length];
}

let tiers           = DEFAULT_TIERS.map(t => ({ ...t }));
let sortables       = {};
let currentShareId  = null;
let currentRoles    = [];
let currentSkills   = [];
let catalogItems    = [];
let currentCat      = "all";
let pendingRoleItem = null;
let pendingSkillSlot = null;  // { el, slot (1|2) }

// ── Construir elemento ítem ────────────────────────────────────────
function buildItemEl(d) {
  const name     = d.name || "?";
  const imgM     = d.image_url   || null;
  const imgF     = d.image_url_f || null;
  const hasGender= !!(imgM && imgF);
  const gender   = d.gender      || "m";
  const activeImg= gender === "f" ? (imgF || imgM) : imgM;
  const isDual   = d.is_dual_weapon === 1 || d.is_dual_weapon === true;

  const div = document.createElement("div");
  div.className = "tl-item" + (hasGender ? " has-gender" : "") + (isDual ? " dual-weapon" : "");
  div.dataset.name      = name;
  div.dataset.itemId    = d.id || d.item_id || "";
  div.dataset.gender    = gender;
  div.dataset.category  = d.category || "general";
  div.dataset.roleId    = d.role_id    || "";
  div.dataset.roleName  = d.role_name  || "";
  div.dataset.roleIcon  = d.role_icon  || "";
  div.dataset.roleColor = d.role_color || "";
  div.dataset.skill1Img = d.skill1_img  || "";
  div.dataset.skill1Name= d.skill1_name || "";
  div.dataset.skill2Img = d.skill2_img  || "";
  div.dataset.skill2Name= d.skill2_name || "";
  if (imgM) div.dataset.imgM = imgM;
  if (imgF) div.dataset.imgF = imgF;

  // imagen o avatar
  let imgHtml;
  if (activeImg) {
    imgHtml = `<img src="${activeImg}" class="tl-item-img" alt="${name}" loading="lazy"
       onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="tl-item-avatar" style="background:${avatarColor(name)};display:none;">${name[0].toUpperCase()}</div>`;
  } else {
    imgHtml = `<div class="tl-item-avatar" style="background:${avatarColor(name)};">${name[0].toUpperCase()}</div>`;
  }

  // rol
  const roleColor = d.role_color || "";
  const roleFilled = !!d.role_name;
  const roleStyle = roleFilled ? `background:${roleColor};border-color:${roleColor};` : "";
  const roleClass = "tl-role-slot" + (roleFilled ? " filled" : "");
  const roleContent = roleFilled
    ? (d.role_icon ? `<span title="${d.role_name}">${d.role_icon}</span>` : d.role_name.substring(0,3))
    : `<span title="Asignar rol">+</span>`;

  // skills
  function skillSlotHtml(slot) {
    const img  = slot === 1 ? d.skill1_img  : d.skill2_img;
    const sname= slot === 1 ? d.skill1_name : d.skill2_name;
    if (img) return `<div class="tl-skill-slot" data-slot="${slot}" title="${sname||''}"><img src="${img}" alt="${sname||''}"></div>`;
    return `<div class="tl-skill-slot" data-slot="${slot}" title="Añadir skill">+</div>`;
  }

  div.innerHTML = `
    ${hasGender ? `
    <div class="tl-gender-toggle">
      <button class="tl-gender-btn${gender!=="f"?" active":""}" data-g="m">M</button>
      <button class="tl-gender-btn${gender==="f"?" active":""}" data-g="f">F</button>
    </div>` : ""}
    <div class="tl-item-core">
      ${imgHtml}
      <div class="tl-item-name">${name}</div>
    </div>
    <div class="tl-item-meta">
      <div class="${roleClass}" style="${roleStyle}" title="${d.role_name||'Asignar rol'}">${roleContent}</div>
      ${skillSlotHtml(1)}
      ${skillSlotHtml(2)}
    </div>
    <div class="tl-role-badge${roleFilled?"":' empty'}" style="background:${roleFilled?roleColor:"transparent"}">
      ${roleFilled ? `${d.role_icon||""} ${d.role_name}` : ""}
    </div>
    <button class="tl-remove" title="Quitar">✕</button>
  `;

  // ── Toggle M/F
  if (hasGender) {
    div.querySelectorAll(".tl-gender-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const g = btn.dataset.g;
        div.dataset.gender = g;
        div.querySelectorAll(".tl-gender-btn").forEach(b => b.classList.toggle("active", b.dataset.g === g));
        const img = div.querySelector(".tl-item-img");
        if (img) {
          const url = g === "f" ? (div.dataset.imgF || div.dataset.imgM) : div.dataset.imgM;
          img.style.display = "";
          img.src = url;
          const av = img.nextElementSibling;
          if (av) av.style.display = "none";
        }
      });
    });
  }

  // ── Clic en role slot → abrir modal de roles
  div.querySelector(".tl-role-slot")?.addEventListener("click", e => {
    e.stopPropagation();
    if (currentRoles.length === 0) return;
    pendingRoleItem = div;
    openRoleModal(name);
  });

  // ── Clic en skill slots → abrir modal de skills
  div.querySelectorAll(".tl-skill-slot").forEach(slot => {
    slot.addEventListener("click", e => {
      e.stopPropagation();
      pendingSkillSlot = { el: div, slot: parseInt(slot.dataset.slot) };
      openSkillModal(name);
    });
  });

  // ── Clic en role badge (en pool) → también abrir modal
  div.querySelector(".tl-role-badge")?.addEventListener("click", e => {
    e.stopPropagation();
    if (currentRoles.length === 0) return;
    pendingRoleItem = div;
    openRoleModal(name);
  });

  // ── Quitar
  div.querySelector(".tl-remove").addEventListener("click", e => {
    e.stopPropagation();
    div.remove();
  });

  return div;
}

// ── Role Modal ─────────────────────────────────────────────────────
function openRoleModal(itemName) {
  const modal = document.getElementById("role-modal");
  const title = document.getElementById("role-modal-title");
  const opts  = document.getElementById("role-modal-options");
  if (!modal) return;

  title.textContent = `Rol para: ${itemName}`;
  opts.innerHTML = "";
  currentRoles.forEach(r => {
    const btn = document.createElement("button");
    btn.className = "tl-role-option";
    btn.style.borderColor = r.color;
    btn.innerHTML = `<span class="tl-role-opt-dot" style="background:${r.color}"></span>${r.icon || ""} ${r.role_name}`;
    btn.addEventListener("click", () => { applyRole(r); closeRoleModal(); });
    opts.appendChild(btn);
  });
  modal.style.display = "flex";
}

function closeRoleModal(returnToPool = false) {
  const modal = document.getElementById("role-modal");
  if (modal) modal.style.display = "none";
  if (returnToPool && pendingRoleItem) {
    const pool = document.getElementById("pool");
    if (pool && !pool.contains(pendingRoleItem)) pool.appendChild(pendingRoleItem);
  }
  pendingRoleItem = null;
}

function applyRole(role) {
  if (!pendingRoleItem) return;
  const div = pendingRoleItem;
  div.dataset.roleId    = role ? role.id      : "";
  div.dataset.roleName  = role ? role.role_name: "";
  div.dataset.roleIcon  = role ? (role.icon||"") : "";
  div.dataset.roleColor = role ? role.color    : "";

  // actualizar role slot (en tier)
  const slot = div.querySelector(".tl-role-slot");
  if (slot) {
    if (role) {
      slot.className  = "tl-role-slot filled";
      slot.style.cssText = `background:${role.color};border-color:${role.color};`;
      slot.innerHTML  = role.icon ? `<span title="${role.role_name}">${role.icon}</span>` : role.role_name.substring(0,3);
    } else {
      slot.className  = "tl-role-slot";
      slot.style.cssText = "";
      slot.innerHTML  = `<span title="Asignar rol">+</span>`;
    }
  }

  // actualizar role badge (en pool)
  const badge = div.querySelector(".tl-role-badge");
  if (badge) {
    badge.textContent  = role ? `${role.icon||""} ${role.role_name}` : "";
    badge.style.background = role ? role.color : "transparent";
    badge.classList.toggle("empty", !role);
  }
}

document.getElementById("role-modal-cancel")?.addEventListener("click", () => closeRoleModal(true));
document.getElementById("role-modal-norole")?.addEventListener("click", () => { applyRole(null); closeRoleModal(); });
document.getElementById("role-modal")?.addEventListener("click", e => { if (e.target === e.currentTarget) closeRoleModal(true); });

// ── Skill Modal ────────────────────────────────────────────────────
function openSkillModal(itemName) {
  const modal = document.getElementById("skill-modal");
  const title = document.getElementById("skill-modal-title");
  const opts  = document.getElementById("skill-modal-options");
  if (!modal) return;

  const slotNum = pendingSkillSlot?.slot || 1;
  title.textContent = `Skill ${slotNum} para: ${itemName}`;
  opts.innerHTML = "";

  currentSkills.forEach(sk => {
    const btn = document.createElement("button");
    btn.className = "tl-skill-option";
    btn.innerHTML = sk.image_url
      ? `<img src="${sk.image_url}" alt="${sk.name}"><span>${sk.name}</span>`
      : `<span style="font-size:.8rem;">⚡</span><span>${sk.name}</span>`;
    btn.addEventListener("click", () => { applySkill(sk); closeSkillModal(); });
    opts.appendChild(btn);
  });

  // Opción "ninguna"
  const none = document.createElement("button");
  none.className = "tl-skill-option";
  none.innerHTML = `<span style="font-size:1.2rem;">✕</span><span>Ninguna</span>`;
  none.addEventListener("click", () => { applySkill(null); closeSkillModal(); });
  opts.appendChild(none);

  modal.style.display = "flex";
}

function closeSkillModal() {
  const modal = document.getElementById("skill-modal");
  if (modal) modal.style.display = "none";
  pendingSkillSlot = null;
}

function applySkill(skill) {
  if (!pendingSkillSlot) return;
  const { el, slot } = pendingSkillSlot;
  const key = slot === 1 ? "skill1" : "skill2";
  el.dataset[`${key}Img`]  = skill ? (skill.image_url || "") : "";
  el.dataset[`${key}Name`] = skill ? skill.name : "";

  const slotEl = el.querySelector(`.tl-skill-slot[data-slot="${slot}"]`);
  if (slotEl) {
    slotEl.innerHTML = skill && skill.image_url
      ? `<img src="${skill.image_url}" alt="${skill.name}">`
      : "+";
  }
}

document.getElementById("skill-modal-cancel")?.addEventListener("click", closeSkillModal);
document.getElementById("skill-modal")?.addEventListener("click", e => { if (e.target === e.currentTarget) closeSkillModal(); });

// ── Sortable ───────────────────────────────────────────────────────
function makeSortable(zone) {
  return Sortable.create(zone, {
    group: "tierlist", animation: 150, ghostClass: "sortable-ghost",
    onAdd(evt) {
      const item     = evt.item;
      const fromPool = evt.from?.id === "pool" || evt.from?.dataset?.tier === "pool";
      const toTier   = evt.to?.classList?.contains("tier-zone");
      if (fromPool && toTier && currentRoles.length > 0) {
        pendingRoleItem = item;
        openRoleModal(item.dataset.name);
      }
    },
  });
}

// ── Categoria tabs ─────────────────────────────────────────────────
function renderCatTabs(categories) {
  const el = document.getElementById("tl-cat-tabs");
  if (!el) return;
  el.innerHTML = "";
  const cats = ["all", ...new Set(categories.filter(c => c && c !== "general"))];
  if (cats.length <= 1) { el.style.display = "none"; return; }
  el.style.display = "flex";
  cats.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "tl-cat-tab" + (c === currentCat ? " active" : "");
    btn.textContent = c === "all" ? "Todos" : c.toUpperCase();
    btn.dataset.cat = c;
    btn.addEventListener("click", () => {
      currentCat = c;
      el.querySelectorAll(".tl-cat-tab").forEach(b => b.classList.toggle("active", b.dataset.cat === c));
      filterPool();
    });
    el.appendChild(btn);
  });
}

function filterPool() {
  document.getElementById("pool")?.querySelectorAll(".tl-item").forEach(item => {
    const cat = item.dataset.category || "general";
    item.style.display = (currentCat === "all" || cat === currentCat) ? "" : "none";
  });
}

// ── Render tiers ───────────────────────────────────────────────────
function renderTiers() {
  const container = document.getElementById("tiers-container");
  const saved = {};
  container.querySelectorAll(".tier-zone").forEach(z => {
    saved[z.dataset.tier] = [...z.querySelectorAll(".tl-item")].map(snapshotItem);
  });
  container.innerHTML = "";
  sortables = {};

  tiers.forEach(t => {
    const row = document.createElement("div");
    row.className = "tier-row";
    row.innerHTML = `
      <div class="tier-label" style="background:${t.color};">${t.label}</div>
      <div class="tier-zone sortable-zone" data-tier="${t.id}"></div>`;
    container.appendChild(row);
    const zone = row.querySelector(".tier-zone");
    (saved[t.id] || []).forEach(snap => zone.appendChild(buildItemEl(snap)));
    sortables[t.id] = makeSortable(zone);
  });
  renderTierControls();
}

function renderTierControls() {
  const el = document.getElementById("tier-controls");
  el.innerHTML = "";
  tiers.forEach((t, i) => {
    const ctrl = document.createElement("div");
    ctrl.className = "tier-ctrl";
    ctrl.innerHTML = `
      <input type="color" class="tier-ctrl-color" value="${t.color}">
      <input type="text"  class="tier-ctrl-name"  value="${t.label}" maxlength="4">
      <button class="btn-ss" style="font-size:.7rem;padding:.2rem .5rem;">✕</button>`;
    ctrl.querySelector(".tier-ctrl-color").addEventListener("input", e => {
      t.color = e.target.value;
      document.querySelectorAll(".tier-label")[i].style.background = t.color;
    });
    ctrl.querySelector(".tier-ctrl-name").addEventListener("input", e => {
      t.label = e.target.value;
      document.querySelectorAll(".tier-label")[i].textContent = t.label;
    });
    ctrl.querySelector("button").addEventListener("click", () => {
      document.querySelector(`.tier-zone[data-tier="${t.id}"]`)
        ?.querySelectorAll(".tl-item").forEach(item => document.getElementById("pool").appendChild(item));
      tiers.splice(i, 1);
      renderTiers();
    });
    el.appendChild(ctrl);
  });
  const addBtn = document.createElement("button");
  addBtn.className = "btn-ss";
  addBtn.textContent = "+ Tier";
  addBtn.style.fontSize = ".8rem";
  addBtn.onclick = () => { tiers.push({ id: "T" + Date.now(), label: "?", color: "#8b5cf6" }); renderTiers(); };
  el.appendChild(addBtn);
}

function initPool() { makeSortable(document.getElementById("pool")); }

// ── Snapshot de item ───────────────────────────────────────────────
function snapshotItem(el) {
  return {
    name:       el.dataset.name,
    item_id:    el.dataset.itemId,
    gender:     el.dataset.gender    || "m",
    role_id:    el.dataset.roleId,
    role_name:  el.dataset.roleName,
    role_icon:  el.dataset.roleIcon,
    role_color: el.dataset.roleColor,
    image_url:  el.dataset.imgM      || null,
    image_url_f:el.dataset.imgF      || null,
    category:   el.dataset.category  || "general",
    skill1_img: el.dataset.skill1Img  || null,
    skill1_name:el.dataset.skill1Name || null,
    skill2_img: el.dataset.skill2Img  || null,
    skill2_name:el.dataset.skill2Name || null,
  };
}

// ── Serializar/restaurar estado ────────────────────────────────────
function getState() {
  const items = { pool: [] };
  document.querySelectorAll(".tier-zone").forEach(z => {
    items[z.dataset.tier] = [...z.querySelectorAll(".tl-item")].map(snapshotItem);
  });
  items.pool = [...document.getElementById("pool").querySelectorAll(".tl-item")].map(snapshotItem);
  return {
    titulo: document.getElementById("tl-titulo")?.value || "Mi Tier List",
    juego:  document.getElementById("tl-juego")?.value  || null,
    tiers:  tiers.map(t => ({ id: t.id, label: t.label, color: t.color })),
    items,
  };
}

function setState(state) {
  if (state.titulo) { document.getElementById("tl-titulo").value = state.titulo; syncTitulo(); }
  if (state.juego)  document.getElementById("tl-juego").value = state.juego;
  if (state.tiers)  tiers = state.tiers.map(t => ({ ...t }));
  renderTiers();

  if (state.items) {
    Object.entries(state.items).forEach(([tierId, arr]) => {
      if (tierId === "pool") return;
      const zone = document.querySelector(`.tier-zone[data-tier="${tierId}"]`);
      if (!zone) return;
      arr.forEach(n => zone.appendChild(buildItemEl(typeof n === "string" ? { name: n } : n)));
    });
    const pool = document.getElementById("pool");
    (state.items.pool || []).forEach(n => {
      const data = typeof n === "string" ? { name: n } : n;
      const el = buildItemEl(data);
      el.dataset.category = data.category || "general";
      pool.appendChild(el);
    });
  }
}

// ── Cargar catálogo ────────────────────────────────────────────────
async function loadCatalog(gameKey) {
  catalogItems = []; currentRoles = []; currentSkills = [];
  try {
    const [iR, rR, sR] = await Promise.all([
      fetch(`${API}/tl-catalog/${gameKey}/items`),
      fetch(`${API}/tl-catalog/${gameKey}/roles`),
      fetch(`${API}/tl-catalog/${gameKey}/skills`),
    ]);
    if (iR.ok) catalogItems  = await iR.json();
    if (rR.ok) currentRoles  = await rR.json();
    if (sR.ok) currentSkills = await sR.json();
  } catch { /* fallback */ }
  return { items: catalogItems, roles: currentRoles, skills: currentSkills };
}

// ── Pool helpers ───────────────────────────────────────────────────
function addCatalogToPool(items) {
  const pool = document.getElementById("pool");
  renderCatTabs(items.map(i => i.category));
  items.forEach(item => {
    if (!document.querySelector(`.tl-item[data-name="${CSS.escape(item.name)}"]`)) {
      const el = buildItemEl(item);
      el.dataset.category = item.category || "general";
      pool.appendChild(el);
    }
  });
}

function addFallbackToPool(names) {
  const pool = document.getElementById("pool");
  names.forEach(name => {
    if (!document.querySelector(`.tl-item[data-name="${CSS.escape(name)}"]`))
      pool.appendChild(buildItemEl({ name }));
  });
}

async function changeGame(gameKey) {
  if (!gameKey) return;
  document.getElementById("pool").innerHTML = "";
  document.querySelectorAll(".tier-zone").forEach(z => z.innerHTML = "");
  currentCat = "all";

  const { items } = await loadCatalog(gameKey);
  if (items.length > 0) {
    addCatalogToPool(items);
  } else {
    renderCatTabs([]);
    addFallbackToPool(FALLBACK_ITEMS[gameKey] || []);
  }
}

// ── Ítem manual ────────────────────────────────────────────────────
function addManualItem() {
  const input = document.getElementById("tl-new-item");
  const name  = input.value.trim();
  if (!name) return;
  document.getElementById("pool").appendChild(buildItemEl({ name }));
  input.value = ""; input.focus();
}

// ── Título ─────────────────────────────────────────────────────────
function syncTitulo() {
  const d = document.getElementById("tl-title-display");
  if (d) d.textContent = document.getElementById("tl-titulo")?.value || "";
}

// ── Event listeners ────────────────────────────────────────────────
document.getElementById("tl-titulo")?.addEventListener("input", syncTitulo);
document.getElementById("tl-juego")?.addEventListener("change", e => changeGame(e.target.value));
document.getElementById("btn-add-item")?.addEventListener("click", addManualItem);
document.getElementById("tl-new-item")?.addEventListener("keydown", e => { if (e.key === "Enter") addManualItem(); });

document.getElementById("btn-reset")?.addEventListener("click", async () => {
  if (!confirm("¿Resetear el tier list? Se perderán los cambios.")) return;
  tiers = DEFAULT_TIERS.map(t => ({ ...t }));
  document.getElementById("pool").innerHTML = "";
  document.querySelectorAll(".tier-zone").forEach(z => z.innerHTML = "");
  renderTiers();
  document.getElementById("tl-juego").value  = "ragnarok";
  document.getElementById("tl-titulo").value = "Mi Tier List";
  syncTitulo(); currentShareId = null; updateSharePanel(null);
  await changeGame("ragnarok");
});

// ── Exportar PNG ───────────────────────────────────────────────────
document.getElementById("btn-export")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-export");
  btn.textContent = "⏳ Generando..."; btn.disabled = true;
  try {
    const wrap = document.getElementById("tierlist-wrap");
    wrap.querySelectorAll(".tl-remove,.tl-gender-toggle,.tl-pool").forEach(b => b.style.display = "none");
    const canvas = await html2canvas(wrap, { backgroundColor: "#0f1117", scale: 2, useCORS: true, logging: false });
    wrap.querySelectorAll(".tl-remove,.tl-gender-toggle,.tl-pool").forEach(b => b.style.display = "");
    const titulo  = (document.getElementById("tl-titulo")?.value || "tierlist").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const link    = document.createElement("a");
    link.download = `${titulo}.png`;
    link.href     = canvas.toDataURL("image/png");
    link.click();
  } catch(e) { alert("Error al exportar: " + e.message); }
  finally { btn.textContent = "📷 Exportar PNG"; btn.disabled = false; }
});

// ── Guardar y compartir ────────────────────────────────────────────
document.getElementById("btn-share")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-share");
  btn.textContent = "⏳ Guardando..."; btn.disabled = true;
  try {
    const state   = getState();
    const token   = localStorage.getItem("ss_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let res, data;
    if (currentShareId) {
      res  = await fetch(`${API}/tierlist/${currentShareId}`, { method: "PUT", headers, body: JSON.stringify(state) });
      data = await res.json();
      if (data.forked) { currentShareId = data.share_id; history.replaceState(null, "", `?tl=${data.share_id}`); }
    } else {
      res  = await fetch(`${API}/tierlist`, { method: "POST", headers, body: JSON.stringify(state) });
      data = await res.json();
      currentShareId = data.share_id;
      history.replaceState(null, "", `?tl=${data.share_id}`);
    }
    updateSharePanel(data.share_id);
  } catch(e) { alert("Error al guardar: " + e.message); }
  finally { btn.textContent = "🔗 Guardar y compartir"; btn.disabled = false; }
});

function updateSharePanel(shareId) {
  const panel = document.getElementById("share-panel");
  const input = document.getElementById("share-url");
  if (!panel || !input) return;
  if (!shareId) { panel.style.display = "none"; return; }
  input.value = `${location.origin}/pages/tierlist/?tl=${shareId}`;
  panel.style.display = "flex";
}

document.getElementById("btn-copy-url")?.addEventListener("click", () => {
  const input = document.getElementById("share-url");
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = document.getElementById("btn-copy-url");
    btn.textContent = "✓ Copiado";
    setTimeout(() => btn.textContent = "Copiar", 2000);
  });
});

// ── Cargar desde URL ───────────────────────────────────────────────
async function loadFromUrl() {
  const id = new URLSearchParams(location.search).get("tl");
  if (!id) return false;
  try {
    const res = await fetch(`${API}/tierlist/${id}`);
    if (!res.ok) return false;
    const data = await res.json();
    currentShareId = id;
    if (data.juego) await loadCatalog(data.juego);
    document.getElementById("pool").innerHTML = "";
    setState(data);
    updateSharePanel(id);
    const authorEl = document.getElementById("tl-author");
    if (authorEl && data.autor_nombre) {
      authorEl.textContent = `Creado por ${data.autor_nombre}`;
      authorEl.style.display = "block";
    }
    return true;
  } catch { return false; }
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  renderTiers(); initPool(); syncTitulo();
  const loaded = await loadFromUrl();
  if (!loaded) {
    document.getElementById("tl-juego").value  = "ragnarok";
    document.getElementById("tl-titulo").value = "Mi Tier List";
    syncTitulo();
    await changeGame("ragnarok");
  }
});
