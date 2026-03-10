// Tier List Builder — SortableJS + html2canvas

const DEFAULT_TIERS = [
  { id: "S", label: "S", color: "#ef4444" },
  { id: "A", label: "A", color: "#f97316" },
  { id: "B", label: "B", color: "#eab308" },
  { id: "C", label: "C", color: "#22c55e" },
  { id: "D", label: "D", color: "#3b82f6" },
  { id: "F", label: "F", color: "#6b7280" },
];

// Items predefinidos por juego
const GAME_ITEMS = {
  ragnarok: [
    "Genetic","Sorcerer","Ranger","Rune Knight","Royal Guard","Archbishop",
    "Shadow Chaser","Guillotine Cross","Warlock","Minstrel","Wanderer","Mechanic"
  ],
  wow: [
    "Paladin","Death Knight","Druid","Warrior","Hunter","Priest",
    "Warlock","Mage","Rogue","Shaman","Monk","Demon Hunter"
  ],
  lineage2: [
    "Tank","Healer","DD Mage","DD Físico","Buffer","Archer","Summoner","Nuker"
  ],
  brawlstars: [
    "Shelly","Nita","Colt","Bull","Jessie","Brock","El Primo","Barley",
    "Poco","Rosa","Primo","Mortis"
  ],
  throneandliberty: [
    "Espada/Escudo","Arco/Daga","Báculo/Libro","Mandoble","Varita/Libro","Arco/Báculo"
  ],
};

let tiers    = DEFAULT_TIERS.map(t => ({ ...t }));
let sortables = {};

// ── Render ─────────────────────────────────────────────────────────
function buildItem(name, img = null) {
  const div = document.createElement("div");
  div.className   = "tl-item";
  div.dataset.name = name;
  div.innerHTML = `
    ${img ? `<img src="${img}" alt="${name}">` : ""}
    <div class="tl-item-name">${name}</div>
    <button class="tl-remove" title="Quitar">✕</button>`;
  div.querySelector(".tl-remove").addEventListener("click", e => {
    e.stopPropagation();
    div.remove();
  });
  return div;
}

function renderTiers() {
  const container = document.getElementById("tiers-container");
  // Guardar ítems actuales por tier
  const saved = {};
  container.querySelectorAll(".tier-zone").forEach(z => {
    saved[z.dataset.tier] = [...z.querySelectorAll(".tl-item")].map(el => ({
      name: el.dataset.name,
      img:  el.querySelector("img")?.src || null,
    }));
  });

  container.innerHTML = "";
  sortables = {};

  tiers.forEach(t => {
    const row = document.createElement("div");
    row.className = "tier-row";
    row.innerHTML = `
      <div class="tier-label" style="background:${t.color};" title="Click para editar">${t.label}</div>
      <div class="tier-zone sortable-zone" data-tier="${t.id}"></div>`;
    container.appendChild(row);

    const zone = row.querySelector(".tier-zone");
    // Restaurar ítems guardados
    (saved[t.id] || []).forEach(item => zone.appendChild(buildItem(item.name, item.img)));

    sortables[t.id] = Sortable.create(zone, {
      group:     "tierlist",
      animation: 150,
      ghostClass: "sortable-ghost",
    });
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
      <input type="color" class="tier-ctrl-color" value="${t.color}" title="Color">
      <input type="text"  class="tier-ctrl-name"  value="${t.label}" maxlength="4" title="Nombre">
      <button class="btn-ss" style="font-size:.7rem;padding:.2rem .5rem;" title="Eliminar tier">✕</button>`;

    ctrl.querySelector(".tier-ctrl-color").addEventListener("input", e => {
      t.color = e.target.value;
      document.querySelectorAll(".tier-label")[i].style.background = t.color;
    });
    ctrl.querySelector(".tier-ctrl-name").addEventListener("input", e => {
      t.label = e.target.value;
      document.querySelectorAll(".tier-label")[i].textContent = t.label;
    });
    ctrl.querySelector("button").addEventListener("click", () => {
      // Mover ítems al pool antes de eliminar
      const zone = document.querySelector(`.tier-zone[data-tier="${t.id}"]`);
      const pool = document.getElementById("pool");
      zone?.querySelectorAll(".tl-item").forEach(item => pool.appendChild(item));
      tiers.splice(i, 1);
      renderTiers();
    });

    el.appendChild(ctrl);
  });

  // Botón añadir tier
  const addBtn = document.createElement("button");
  addBtn.className   = "btn-ss";
  addBtn.textContent = "+ Tier";
  addBtn.style.cssText = "font-size:.8rem;";
  addBtn.onclick = () => {
    const id = "T" + Date.now();
    tiers.push({ id, label: "?", color: "#8b5cf6" });
    renderTiers();
  };
  el.appendChild(addBtn);
}

// ── Pool ───────────────────────────────────────────────────────────
function initPool() {
  Sortable.create(document.getElementById("pool"), {
    group:     "tierlist",
    animation: 150,
    ghostClass: "sortable-ghost",
  });
}

function addItemsToPool(names) {
  const pool = document.getElementById("pool");
  names.forEach(name => {
    if (!document.querySelector(`.tl-item[data-name="${CSS.escape(name)}"]`)) {
      pool.appendChild(buildItem(name));
    }
  });
}

// ── Juego selector ─────────────────────────────────────────────────
document.getElementById("tl-juego")?.addEventListener("change", e => {
  const items = GAME_ITEMS[e.target.value];
  if (items) {
    // Limpiar pool y tiers
    document.getElementById("pool").innerHTML = "";
    document.querySelectorAll(".tier-zone").forEach(z => z.innerHTML = "");
    addItemsToPool(items);
  }
});

// ── Añadir ítem manual ─────────────────────────────────────────────
function addManualItem() {
  const input = document.getElementById("tl-new-item");
  const name  = input.value.trim();
  if (!name) return;
  addItemsToPool([name]);
  input.value = "";
  input.focus();
}

document.getElementById("btn-add-item")?.addEventListener("click", addManualItem);
document.getElementById("tl-new-item")?.addEventListener("keydown", e => {
  if (e.key === "Enter") addManualItem();
});

// ── Título ─────────────────────────────────────────────────────────
const tituloInput = document.getElementById("tl-titulo");
const tituloDisplay = document.getElementById("tl-title-display");
function syncTitulo() { tituloDisplay.textContent = tituloInput?.value || ""; }
tituloInput?.addEventListener("input", syncTitulo);

// ── Reset ──────────────────────────────────────────────────────────
document.getElementById("btn-reset")?.addEventListener("click", () => {
  if (!confirm("¿Resetear el tier list? Se perderán los cambios.")) return;
  tiers = DEFAULT_TIERS.map(t => ({ ...t }));
  document.getElementById("pool").innerHTML = "";
  document.querySelectorAll(".tier-zone").forEach(z => z.innerHTML = "");
  renderTiers();
  document.getElementById("tl-juego").value = "";
  tituloInput.value = "Mi Tier List";
  syncTitulo();
});

// ── Exportar PNG ───────────────────────────────────────────────────
document.getElementById("btn-export")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-export");
  btn.textContent = "⏳ Generando...";
  btn.disabled    = true;

  try {
    const wrap = document.getElementById("tierlist-wrap");
    // Ocultar temporalmente el botón de eliminar para el export
    wrap.querySelectorAll(".tl-remove").forEach(b => b.style.display = "none");

    const canvas = await html2canvas(wrap, {
      backgroundColor: "#0f1117",
      scale: 2,
      useCORS: true,
      logging: false,
    });

    wrap.querySelectorAll(".tl-remove").forEach(b => b.style.display = "");

    const link    = document.createElement("a");
    const titulo  = (tituloInput?.value || "tierlist").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    link.download = `${titulo}.png`;
    link.href     = canvas.toDataURL("image/png");
    link.click();
  } catch(e) {
    alert("Error al exportar: " + e.message);
  } finally {
    btn.textContent = "📷 Exportar PNG";
    btn.disabled    = false;
  }
});

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderTiers();
  initPool();
  syncTitulo();

  // Ítems por defecto (Ragnarok)
  document.getElementById("tl-juego").value = "ragnarok";
  addItemsToPool(GAME_ITEMS.ragnarok);
  syncTitulo();
});
