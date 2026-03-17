const API = "https://sunshinesquad.es/api";

let activeGame = "";
let activeTab  = "items";

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

// ── Inventario ───────────────────────────────────────────────────────
async function loadItems(game = "") {
  const el = document.getElementById("items-content");
  el.innerHTML = `<div class="text-center py-5" style="color:rgba(255,255,255,.3);">Cargando…</div>`;

  const url = game ? `${API}/bank?game=${encodeURIComponent(game)}` : `${API}/bank`;
  let data;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    data = await res.json();
  } catch {
    el.innerHTML = `<div class="text-center py-4" style="color:rgba(255,255,255,.3);">Error al cargar inventario.</div>`;
    return;
  }

  const items = data.items || [];
  if (!items.length) {
    el.innerHTML = `<div class="text-center py-4" style="color:rgba(255,255,255,.3);">El banco está vacío.</div>`;
    return;
  }

  // Group by game (then by category)
  const byGame = {};
  items.forEach(item => {
    const key = item.game_id;
    if (!byGame[key]) byGame[key] = { name: item.game_name, command_key: item.command_key, categories: {} };
    const cat = item.category || "General";
    if (!byGame[key].categories[cat]) byGame[key].categories[cat] = [];
    byGame[key].categories[cat].push(item);
  });

  let html = "";
  Object.values(byGame).forEach(g => {
    html += `
      <div class="card-dark mb-4">
        <div class="perfil-section-title mb-3">🎮 ${g.name}</div>
    `;
    Object.entries(g.categories).forEach(([cat, catItems]) => {
      html += `
        <div style="margin-bottom:1rem;">
          <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.4px;
                      color:rgba(255,255,255,.3);margin-bottom:.6rem;">${cat}</div>
          <div class="row g-2">
            ${catItems.map(item => `
              <div class="col-sm-6 col-md-4 col-lg-3">
                <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
                            border-radius:12px;padding:.75rem;display:flex;align-items:center;gap:.6rem;">
                  <span style="font-size:1.4rem;flex-shrink:0;">${item.item_emoji}</span>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:.85rem;font-weight:700;color:#fff;">${item.item_name}</div>
                    ${item.item_code ? `<div style="font-size:.68rem;color:rgba(255,255,255,.25);">${item.item_code}</div>` : ""}
                  </div>
                  <div style="font-size:1rem;font-weight:900;color:#a5b4fc;flex-shrink:0;">×${item.quantity}</div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    });
    html += `</div>`;
  });

  el.innerHTML = html;
}

// ── Movimientos ──────────────────────────────────────────────────────
async function loadTransactions(game = "") {
  const el = document.getElementById("txn-content");
  el.innerHTML = `<div class="text-center py-5" style="color:rgba(255,255,255,.3);">Cargando…</div>`;

  const url = game
    ? `${API}/bank/transactions?game=${encodeURIComponent(game)}&limit=50`
    : `${API}/bank/transactions?limit=50`;

  let rows;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    rows = await res.json();
  } catch {
    el.innerHTML = `<div class="text-center py-4" style="color:rgba(255,255,255,.3);">Error al cargar movimientos.</div>`;
    return;
  }

  if (!rows.length) {
    el.innerHTML = `<div class="text-center py-4" style="color:rgba(255,255,255,.3);">Sin movimientos registrados.</div>`;
    return;
  }

  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,.08);font-size:.7rem;color:rgba(255,255,255,.35);
                     text-transform:uppercase;letter-spacing:.4px;">
            <th style="padding:.5rem .75rem;text-align:left;">Tipo</th>
            <th style="padding:.5rem .75rem;text-align:left;">Item</th>
            <th style="padding:.5rem .75rem;text-align:right;">Cantidad</th>
            <th style="padding:.5rem .75rem;text-align:left;">Juego</th>
            <th style="padding:.5rem .75rem;text-align:left;">Nota</th>
            <th style="padding:.5rem .75rem;text-align:left;white-space:nowrap;">Fecha</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const isIn  = r.tx_type === "in";
            const color = isIn ? "#86efac" : "#fca5a5";
            const sign  = isIn ? "+" : "−";
            return `
              <tr style="border-bottom:1px solid rgba(255,255,255,.04);"
                  onmouseover="this.style.background='rgba(255,255,255,.02)'"
                  onmouseout="this.style.background=''">
                <td style="padding:.6rem .75rem;">
                  <span style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.3px;
                               padding:.15rem .5rem;border-radius:999px;
                               background:${isIn ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)"};
                               color:${color};">
                    ${isIn ? "Entrada" : "Salida"}
                  </span>
                </td>
                <td style="padding:.6rem .75rem;font-size:.85rem;color:#fff;font-weight:600;">${r.item_name}</td>
                <td style="padding:.6rem .75rem;text-align:right;font-weight:900;font-size:.95rem;color:${color};">
                  ${sign}${Math.abs(r.qty_change)}
                </td>
                <td style="padding:.6rem .75rem;font-size:.78rem;color:rgba(255,255,255,.4);">${r.game_name}</td>
                <td style="padding:.6rem .75rem;font-size:.78rem;color:rgba(255,255,255,.35);max-width:200px;
                           white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${r.note || "—"}</td>
                <td style="padding:.6rem .75rem;font-size:.72rem;color:rgba(255,255,255,.3);white-space:nowrap;">
                  ${fmtDate(r.created_at)}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ── Tabs ─────────────────────────────────────────────────────────────
document.querySelectorAll("[data-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    activeTab = btn.dataset.tab;
    document.getElementById("panel-items").style.display = activeTab === "items" ? "" : "none";
    document.getElementById("panel-txn").style.display   = activeTab === "txn"   ? "" : "none";

    document.querySelectorAll("[data-tab]").forEach(b => {
      const on = b === btn;
      b.classList.toggle("btn-indigo", on);
      b.classList.toggle("active", on);
      if (!on) b.style.cssText = "background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);";
      else      b.style.cssText = "";
    });

    if (activeTab === "txn") loadTransactions(activeGame);
  });
});

// ── Game filters ─────────────────────────────────────────────────────
async function buildFilters() {
  try {
    const res = await fetch(`${API}/games`);
    if (!res.ok) return;
    const games = await res.json();
    const bar = document.getElementById("filtros-game");
    games.filter(g => g.activo !== 0).forEach(g => {
      const btn = document.createElement("button");
      btn.className = "btn btn-sm";
      btn.style.cssText = "background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);";
      btn.dataset.game = g.command_key || "";
      btn.innerHTML = `${g.emoji || "🎮"} ${g.nombre}`;
      bar.appendChild(btn);
    });
  } catch {}

  document.getElementById("filtros-game").addEventListener("click", e => {
    const btn = e.target.closest("[data-game]");
    if (!btn) return;
    activeGame = btn.dataset.game;

    document.querySelectorAll("#filtros-game button").forEach(b => {
      const on = b === btn;
      b.classList.toggle("btn-indigo", on);
      b.classList.toggle("active", on);
      if (!on) b.style.cssText = "background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);";
      else      b.style.cssText = "";
    });

    if (activeTab === "items") loadItems(activeGame);
    else loadTransactions(activeGame);
  });
}

buildFilters();
loadItems();
