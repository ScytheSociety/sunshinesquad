// Tier List Builder — SortableJS + html2canvas + Save/Share

const API = "https://sunshinesquad.es/api";

const DEFAULT_TIERS = [
  { id: "S", label: "S", color: "#ef4444" },
  { id: "A", label: "A", color: "#f97316" },
  { id: "B", label: "B", color: "#eab308" },
  { id: "C", label: "C", color: "#22c55e" },
  { id: "D", label: "D", color: "#3b82f6" },
  { id: "F", label: "F", color: "#6b7280" },
];

const GAME_ITEMS = {
  ragnarok:       ["Genetic","Sorcerer","Ranger","Rune Knight","Royal Guard","Archbishop","Shadow Chaser","Guillotine Cross","Warlock","Minstrel","Wanderer","Mechanic"],
  wow:            ["Paladin","Death Knight","Druid","Warrior","Hunter","Priest","Warlock","Mage","Rogue","Shaman","Monk","Demon Hunter"],
  lineage2:       ["Tank","Healer","DD Mage","DD Físico","Buffer","Archer","Summoner","Nuker"],
  brawlstars:     ["Shelly","Nita","Colt","Bull","Jessie","Brock","El Primo","Barley","Poco","Rosa","Primo","Mortis"],
  throneandliberty:["Espada/Escudo","Arco/Daga","Báculo/Libro","Mandoble","Varita/Libro","Arco/Báculo"],
};

let tiers     = DEFAULT_TIERS.map(t => ({ ...t }));
let sortables = {};
let currentShareId = null;  // ID del tierlist cargado desde URL

// ── Serializar estado ──────────────────────────────────────────────
function getState() {
  const items = { pool: [] };
  document.querySelectorAll(".tier-zone").forEach(z => {
    items[z.dataset.tier] = [...z.querySelectorAll(".tl-item")].map(el => el.dataset.name);
  });
  items.pool = [...document.getElementById("pool").querySelectorAll(".tl-item")].map(el => el.dataset.name);
  return {
    titulo: document.getElementById("tl-titulo")?.value || "Mi Tier List",
    juego:  document.getElementById("tl-juego")?.value || null,
    tiers:  tiers.map(t => ({ id: t.id, label: t.label, color: t.color })),
    items,
  };
}

// ── Restaurar estado ───────────────────────────────────────────────
function setState(state) {
  if (state.titulo) { document.getElementById("tl-titulo").value = state.titulo; syncTitulo(); }
  if (state.juego)  { document.getElementById("tl-juego").value  = state.juego; }
  if (state.tiers)  { tiers = state.tiers.map(t => ({ ...t })); }
  renderTiers();

  // Poblar tiers con ítems
  if (state.items) {
    Object.entries(state.items).forEach(([tierId, names]) => {
      if (tierId === "pool") return;
      const zone = document.querySelector(`.tier-zone[data-tier="${tierId}"]`);
      if (zone) names.forEach(n => zone.appendChild(buildItem(n)));
    });
    // Pool
    const pool = document.getElementById("pool");
    (state.items.pool || []).forEach(n => pool.appendChild(buildItem(n)));
  }
}

// ── Render ─────────────────────────────────────────────────────────
function buildItem(name) {
  const div = document.createElement("div");
  div.className    = "tl-item";
  div.dataset.name = name;
  div.innerHTML    = `<div class="tl-item-name">${name}</div><button class="tl-remove" title="Quitar">✕</button>`;
  div.querySelector(".tl-remove").addEventListener("click", e => { e.stopPropagation(); div.remove(); });
  return div;
}

function renderTiers() {
  const container = document.getElementById("tiers-container");
  const saved = {};
  container.querySelectorAll(".tier-zone").forEach(z => {
    saved[z.dataset.tier] = [...z.querySelectorAll(".tl-item")].map(el => el.dataset.name);
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
    (saved[t.id] || []).forEach(name => zone.appendChild(buildItem(name)));

    sortables[t.id] = Sortable.create(zone, { group: "tierlist", animation: 150, ghostClass: "sortable-ghost" });
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
      const zone = document.querySelector(`.tier-zone[data-tier="${t.id}"]`);
      const pool = document.getElementById("pool");
      zone?.querySelectorAll(".tl-item").forEach(item => pool.appendChild(item));
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

function initPool() {
  Sortable.create(document.getElementById("pool"), { group: "tierlist", animation: 150, ghostClass: "sortable-ghost" });
}

function addItemsToPool(names) {
  const pool = document.getElementById("pool");
  names.forEach(name => {
    if (!document.querySelector(`.tl-item[data-name="${CSS.escape(name)}"]`)) {
      pool.appendChild(buildItem(name));
    }
  });
}

// ── Título ─────────────────────────────────────────────────────────
function syncTitulo() {
  const v = document.getElementById("tl-titulo")?.value || "";
  const d = document.getElementById("tl-title-display");
  if (d) d.textContent = v;
}
document.getElementById("tl-titulo")?.addEventListener("input", syncTitulo);

// ── Juego ──────────────────────────────────────────────────────────
document.getElementById("tl-juego")?.addEventListener("change", e => {
  const items = GAME_ITEMS[e.target.value];
  if (items) {
    document.getElementById("pool").innerHTML = "";
    document.querySelectorAll(".tier-zone").forEach(z => z.innerHTML = "");
    addItemsToPool(items);
  }
});

// ── Añadir ítem ────────────────────────────────────────────────────
function addManualItem() {
  const input = document.getElementById("tl-new-item");
  const name  = input.value.trim();
  if (!name) return;
  addItemsToPool([name]);
  input.value = "";
  input.focus();
}
document.getElementById("btn-add-item")?.addEventListener("click", addManualItem);
document.getElementById("tl-new-item")?.addEventListener("keydown", e => { if (e.key === "Enter") addManualItem(); });

// ── Reset ──────────────────────────────────────────────────────────
document.getElementById("btn-reset")?.addEventListener("click", () => {
  if (!confirm("¿Resetear el tier list? Se perderán los cambios.")) return;
  tiers = DEFAULT_TIERS.map(t => ({ ...t }));
  document.getElementById("pool").innerHTML = "";
  document.querySelectorAll(".tier-zone").forEach(z => z.innerHTML = "");
  renderTiers();
  document.getElementById("tl-juego").value = "ragnarok";
  document.getElementById("tl-titulo").value = "Mi Tier List";
  addItemsToPool(GAME_ITEMS.ragnarok);
  syncTitulo();
  currentShareId = null;
  updateSharePanel(null);
});

// ── Exportar PNG ───────────────────────────────────────────────────
document.getElementById("btn-export")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-export");
  btn.textContent = "⏳ Generando...";
  btn.disabled = true;
  try {
    const wrap = document.getElementById("tierlist-wrap");
    wrap.querySelectorAll(".tl-remove").forEach(b => b.style.display = "none");
    const canvas = await html2canvas(wrap, { backgroundColor: "#0f1117", scale: 2, useCORS: true, logging: false });
    wrap.querySelectorAll(".tl-remove").forEach(b => b.style.display = "");
    const link    = document.createElement("a");
    const titulo  = (document.getElementById("tl-titulo")?.value || "tierlist").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    link.download = `${titulo}.png`;
    link.href     = canvas.toDataURL("image/png");
    link.click();
  } catch(e) {
    alert("Error al exportar: " + e.message);
  } finally {
    btn.textContent = "📷 Exportar PNG";
    btn.disabled = false;
  }
});

// ── Guardar y compartir ────────────────────────────────────────────
document.getElementById("btn-share")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-share");
  btn.textContent = "⏳ Guardando...";
  btn.disabled = true;

  try {
    const state   = getState();
    const token   = localStorage.getItem("ss_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let res, data;
    if (currentShareId) {
      // Actualizar o forkear
      res  = await fetch(`${API}/tierlist/${currentShareId}`, { method: "PUT", headers, body: JSON.stringify(state) });
      data = await res.json();
      if (data.forked) {
        currentShareId = data.share_id;
        history.replaceState(null, "", `?tl=${data.share_id}`);
      }
    } else {
      res  = await fetch(`${API}/tierlist`, { method: "POST", headers, body: JSON.stringify(state) });
      data = await res.json();
      currentShareId = data.share_id;
      history.replaceState(null, "", `?tl=${data.share_id}`);
    }

    updateSharePanel(data.share_id);
  } catch(e) {
    alert("Error al guardar: " + e.message);
  } finally {
    btn.textContent = "🔗 Guardar y compartir";
    btn.disabled = false;
  }
});

function updateSharePanel(shareId) {
  const panel = document.getElementById("share-panel");
  const input = document.getElementById("share-url");
  if (!panel || !input) return;
  if (!shareId) { panel.style.display = "none"; return; }
  const url = `${location.origin}/pages/tierlist/?tl=${shareId}`;
  input.value = url;
  panel.style.display = "flex";
}

document.getElementById("btn-copy-url")?.addEventListener("click", () => {
  const input = document.getElementById("share-url");
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = document.getElementById("btn-copy-url");
    btn.textContent = "✓ Copiado";
    setTimeout(() => btn.textContent = "Copiar", 2000);
  });
});

// ── Cargar desde URL (?tl=xxx) ─────────────────────────────────────
async function loadFromUrl() {
  const id = new URLSearchParams(location.search).get("tl");
  if (!id) return false;

  try {
    const res  = await fetch(`${API}/tierlist/${id}`);
    if (!res.ok) return false;
    const data = await res.json();
    currentShareId = id;

    // Limpiar antes de cargar
    document.getElementById("pool").innerHTML = "";

    setState(data);
    updateSharePanel(id);

    // Mostrar autor
    const authorEl = document.getElementById("tl-author");
    if (authorEl && data.autor_nombre) {
      authorEl.textContent = `Creado por ${data.autor_nombre}`;
      authorEl.style.display = "block";
    }
    return true;
  } catch {
    return false;
  }
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  renderTiers();
  initPool();
  syncTitulo();

  const loaded = await loadFromUrl();
  if (!loaded) {
    // Default: Ragnarok
    document.getElementById("tl-juego").value = "ragnarok";
    addItemsToPool(GAME_ITEMS.ragnarok);
    syncTitulo();
  }
});
