import { getUser, apiFetch } from "/assets/js/auth.js";

const ROLE_LVL = { admin:4, moderador:3, editor:2, miembro:1, visitante:0 };

let allBosses = [];

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

function statusBadge(s) {
  if (s === "active")  return `<span style="font-size:.68rem;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:#86efac;border-radius:6px;padding:.1rem .45rem;">⚡ Activo</span>`;
  if (s === "expired") return `<span style="font-size:.68rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.35);border-radius:6px;padding:.1rem .45rem;">💤 Expirado</span>`;
  return `<span style="font-size:.68rem;color:rgba(255,255,255,.3);">${s}</span>`;
}

async function loadStats() {
  const res = await apiFetch("/mvp/admin/stats");
  if (!res || !res.ok) return;
  const d = await res.json();
  document.getElementById("stat-total").textContent   = d.total;
  document.getElementById("stat-active").textContent  = d.active;
  document.getElementById("stat-hunters").textContent = d.hunters;
  document.getElementById("stat-top").textContent     = d.top_boss;
}

async function loadKills() {
  const el     = document.getElementById("kills-table");
  const status = document.getElementById("filter-status").value;
  el.innerHTML = `<div class="text-center py-4" style="color:rgba(255,255,255,.3);">Cargando…</div>`;

  const res = await apiFetch(`/mvp/admin/kills?status=${status}&limit=100`);
  if (!res || !res.ok) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;padding:1rem;">No disponible.</div>`; return; }
  const rows = await res.json();

  if (!rows.length) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;padding:1rem;">Sin kills registrados.</div>`; return; }

  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:.83rem;">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.35);font-size:.68rem;text-transform:uppercase;letter-spacing:.4px;">
            <th style="padding:.4rem .6rem;text-align:left;">Boss</th>
            <th style="padding:.4rem .6rem;text-align:left;">Hunter</th>
            <th style="padding:.4rem .6rem;text-align:left;">Killed at</th>
            <th style="padding:.4rem .6rem;text-align:left;">Respawn</th>
            <th style="padding:.4rem .6rem;text-align:left;">Estado</th>
            <th style="padding:.4rem .6rem;text-align:left;">Mapa</th>
            <th style="padding:.4rem .6rem;"></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr style="border-bottom:1px solid rgba(255,255,255,.04);" data-id="${r.id}">
              <td style="padding:.5rem .6rem;">
                <div style="display:flex;align-items:center;gap:.5rem;">
                  ${r.boss_img ? `<img src="${r.boss_img}" alt="" style="width:28px;height:28px;object-fit:contain;border-radius:4px;opacity:.85;">` : `<div style="width:28px;height:28px;background:rgba(255,255,255,.05);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:.8rem;">💀</div>`}
                  <span style="font-weight:600;color:#fff;">${r.boss_name || "—"}</span>
                </div>
              </td>
              <td style="padding:.5rem .6rem;color:rgba(255,255,255,.6);">${r.hunter_name}</td>
              <td style="padding:.5rem .6rem;color:rgba(255,255,255,.4);white-space:nowrap;">${fmtDate(r.killed_at)}</td>
              <td style="padding:.5rem .6rem;color:rgba(255,255,255,.4);white-space:nowrap;">${fmtDate(r.respawn_at)}</td>
              <td style="padding:.5rem .6rem;">${statusBadge(r.status)}</td>
              <td style="padding:.5rem .6rem;color:rgba(255,255,255,.35);font-size:.76rem;">${r.map || "—"}</td>
              <td style="padding:.5rem .6rem;text-align:right;">
                <button onclick="deleteKill(${r.id})"
                  style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#fca5a5;border-radius:6px;padding:.2rem .55rem;font-size:.72rem;cursor:pointer;">
                  🗑️
                </button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function deleteKill(id) {
  if (!confirm("¿Eliminar este registro de kill?")) return;
  const res = await apiFetch(`/mvp/admin/kill/${id}`, { method: "DELETE" });
  if (res && res.ok) loadKills();
  else alert("Error al eliminar.");
}
window.deleteKill = deleteKill;

async function loadBosses() {
  const el  = document.getElementById("bosses-table");
  el.innerHTML = `<div class="text-center py-4" style="color:rgba(255,255,255,.3);">Cargando…</div>`;

  const res = await apiFetch("/mvp/admin/bosses");
  if (!res || !res.ok) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;padding:1rem;">No disponible.</div>`; return; }
  allBosses = await res.json();
  renderBosses(allBosses);
}

function renderBosses(list) {
  const el = document.getElementById("bosses-table");
  if (!list.length) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;padding:1rem;">Sin bosses.</div>`; return; }

  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:.83rem;">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.35);font-size:.68rem;text-transform:uppercase;letter-spacing:.4px;">
            <th style="padding:.4rem .6rem;text-align:left;">Boss</th>
            <th style="padding:.4rem .6rem;text-align:left;">Mapa</th>
            <th style="padding:.4rem .6rem;text-align:center;">Respawn (min)</th>
            <th style="padding:.4rem .6rem;text-align:center;">Kills</th>
            <th style="padding:.4rem .6rem;text-align:center;">Activo</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(b => `
            <tr style="border-bottom:1px solid rgba(255,255,255,.04);">
              <td style="padding:.5rem .6rem;">
                <div style="display:flex;align-items:center;gap:.5rem;">
                  ${b.imagen ? `<img src="${b.imagen}" alt="" style="width:28px;height:28px;object-fit:contain;border-radius:4px;opacity:.85;">` : `<div style="width:28px;height:28px;background:rgba(255,255,255,.05);border-radius:4px;"></div>`}
                  <div>
                    <div style="font-weight:600;color:#fff;">${b.nombre}</div>
                    <div style="font-size:.7rem;color:rgba(255,255,255,.3);">${b.categoria} · ${b.elemento || "?"}</div>
                  </div>
                </div>
              </td>
              <td style="padding:.5rem .6rem;color:rgba(255,255,255,.4);font-size:.78rem;">${b.nombre_mapa || "—"}</td>
              <td style="padding:.5rem .6rem;text-align:center;">
                <input type="number" value="${b.hora_respawn}" min="1"
                  style="width:70px;text-align:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;border-radius:6px;padding:.2rem .4rem;font-size:.82rem;"
                  onchange="saveBoss(${b.id}, {hora_respawn: +this.value})">
              </td>
              <td style="padding:.5rem .6rem;text-align:center;color:#a5b4fc;font-weight:700;">${b.total_kills}</td>
              <td style="padding:.5rem .6rem;text-align:center;">
                <label style="cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;">
                  <input type="checkbox" ${b.is_active ? "checked" : ""}
                    style="accent-color:#6366f1;width:15px;height:15px;"
                    onchange="saveBoss(${b.id}, {is_active: this.checked})">
                  <span style="font-size:.72rem;color:rgba(255,255,255,.4);">${b.is_active ? "Sí" : "No"}</span>
                </label>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function filterBosses() {
  const q = document.getElementById("boss-search").value.toLowerCase();
  renderBosses(allBosses.filter(b => b.nombre.toLowerCase().includes(q) || (b.nombre_mapa || "").toLowerCase().includes(q)));
}
window.filterBosses = filterBosses;

async function saveBoss(id, changes) {
  await apiFetch(`/mvp/admin/boss/${id}`, { method: "PUT", body: JSON.stringify(changes) });
  loadStats();
}
window.saveBoss = saveBoss;

function switchTab(tab) {
  document.getElementById("panel-kills").style.display  = tab === "kills"  ? "" : "none";
  document.getElementById("panel-bosses").style.display = tab === "bosses" ? "" : "none";
  document.getElementById("tab-kills").className  = "btn-ss" + (tab === "kills"  ? " active" : "");
  document.getElementById("tab-bosses").className = "btn-ss" + (tab === "bosses" ? " active" : "");
}
window.switchTab = switchTab;

document.addEventListener("DOMContentLoaded", () => {
  const user = getUser();
  if (!user || (ROLE_LVL[user.role] || 0) < 3) {
    document.getElementById("access-denied").style.display = "";
    return;
  }
  document.getElementById("mvp-content").style.display = "";
  loadStats();
  loadKills();
  loadBosses();
  document.getElementById("filter-status").addEventListener("change", loadKills);
});
