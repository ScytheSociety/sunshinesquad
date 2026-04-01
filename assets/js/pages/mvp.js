const API = "https://sunshinesquad.es/api";

let allMVPs   = [];
let activeFilter = "all";
let countdownInterval = null;
let autoRefreshInterval = null;
let lastRefresh = null;

// ── Helpers de tiempo ──────────────────────────────────────────────────────────

/** "YYYY-MM-DD HH:MM:SS" → Date (UTC) */
function parseUtc(str) {
  if (!str) return new Date(NaN);
  return new Date(str.replace(" ", "T") + "Z");
}

/** Date → "jue, 1 abr 2026, 13:35" en hora local del navegador */
function fmtLocal(date) {
  if (isNaN(date)) return "—";
  return date.toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** Date → "2026-04-01 13:35 UTC" */
function fmtUtc(date) {
  if (isNaN(date)) return "—";
  const y  = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d  = String(date.getUTCDate()).padStart(2, "0");
  const h  = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d} ${h}:${mi} UTC`;
}

function fmtCountdown(ms) {
  if (ms <= 0) return "¡Spawneando!";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${String(m).padStart(2, "0")}m`);
  parts.push(`${String(s).padStart(2, "0")}s`);
  return parts.join(" ");
}

function getStatus(respawnAt) {
  const diff = parseUtc(respawnAt) - new Date();
  if (diff <= 0)         return "spawning";
  if (diff < 30 * 60000) return "soon";
  return "waiting";
}

function statusConfig(status) {
  const cfg = {
    spawning: { label: "¡Disponible!",  dot: "#22c55e", badge: "rgba(34,197,94,.15)",   border: "rgba(34,197,94,.35)",   color: "#86efac"           },
    soon:     { label: "Pronto",         dot: "#fbbf24", badge: "rgba(251,191,36,.1)",   border: "rgba(251,191,36,.3)",   color: "#fcd34d"           },
    waiting:  { label: "En cooldown",    dot: "#6b7280", badge: "rgba(107,114,128,.1)",  border: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.4)" },
  };
  return cfg[status] || cfg.waiting;
}

// ── Render ─────────────────────────────────────────────────────────────────────

function renderMVPs(mvps) {
  const grid = document.getElementById("mvp-grid");

  const filtered = activeFilter === "all"
    ? mvps
    : mvps.filter(m => getStatus(m.respawn_at) === activeFilter);

  if (!filtered.length) {
    grid.innerHTML = `<div class="col-12 text-center py-5" style="color:rgba(255,255,255,.3);">
      ${activeFilter === "all" ? "Sin MVPs activos ahora mismo." : "Ningún MVP en este estado."}
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map((m, idx) => {
    const status      = getStatus(m.respawn_at);
    const cfg         = statusConfig(status);
    const respawnDate = parseUtc(m.respawn_at);
    const diff        = respawnDate - new Date();

    return `
      <div class="col-sm-6 col-lg-4">
        <div class="mvp-card" data-mvp-idx="${idx}"
          style="background:rgba(255,255,255,.03);border:1px solid ${cfg.border};border-radius:16px;
                 padding:1rem;height:100%;cursor:pointer;transition:border-color .15s,background .15s;"
          onmouseover="this.style.background='rgba(255,255,255,.055)'"
          onmouseout="this.style.background='rgba(255,255,255,.03)'">

          <!-- Cabecera: imagen + nombre -->
          <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem;">
            ${m.image_url
              ? `<img src="${m.image_url}" alt="${m.boss_name}" width="56" height="56"
                      style="border-radius:12px;object-fit:contain;background:rgba(255,255,255,.04);flex-shrink:0;" loading="lazy">`
              : `<div style="width:56px;height:56px;border-radius:12px;background:rgba(99,102,241,.12);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">💀</div>`
            }
            <div style="flex:1;min-width:0;">
              <div style="font-weight:800;font-size:.95rem;color:#fff;margin-bottom:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.boss_name}</div>
              <div style="font-size:.72rem;color:rgba(255,255,255,.35);">📍 ${m.map || "?"}</div>
              ${m.categoria ? `<div style="font-size:.68rem;color:rgba(255,255,255,.22);">${m.categoria}</div>` : ""}
            </div>
          </div>

          <!-- Estado + countdown -->
          <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.4rem;">
            <span style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.4px;
                         padding:.2rem .6rem;border-radius:999px;background:${cfg.badge};
                         border:1px solid ${cfg.border};color:${cfg.color};">
              ${cfg.label}
            </span>
            <span class="mvp-countdown" data-respawn="${m.respawn_at}"
                  style="font-size:1rem;font-weight:900;font-variant-numeric:tabular-nums;color:${cfg.color};">
              ${fmtCountdown(diff)}
            </span>
          </div>

          <!-- Horas de respawn -->
          <div style="border-top:1px solid rgba(255,255,255,.05);padding-top:.4rem;">
            <div style="font-size:.68rem;color:rgba(255,255,255,.45);">⏰ ${fmtLocal(respawnDate)}</div>
            <div style="font-size:.62rem;color:rgba(255,255,255,.22);">🌐 ${fmtUtc(respawnDate)}</div>
          </div>

          <!-- Toque para detalle -->
          <div style="margin-top:.35rem;font-size:.6rem;color:rgba(255,255,255,.15);text-align:right;">
            Ver detalles →
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Guardar la lista filtrada para acceder en el click
  grid._filteredMVPs = filtered;
}

// ── Modal de detalle ───────────────────────────────────────────────────────────

function openDetailModal(m) {
  const respawnDate = parseUtc(m.respawn_at);
  const killedDate  = parseUtc(m.killed_at);
  const naviCmd     = m.navigation && m.coord_x && m.coord_y
    ? `${m.navigation} ${m.coord_x}/${m.coord_y}`
    : m.navigation || null;

  document.getElementById("modal-boss-name").textContent = m.boss_name;

  document.getElementById("modal-body").innerHTML = `
    <div style="display:flex;gap:1rem;align-items:flex-start;margin-bottom:1rem;">
      ${m.image_url
        ? `<img src="${m.image_url}" alt="${m.boss_name}" width="80" height="80"
                style="border-radius:12px;object-fit:contain;background:rgba(255,255,255,.04);flex-shrink:0;">`
        : `<div style="width:80px;height:80px;border-radius:12px;background:rgba(99,102,241,.12);display:flex;align-items:center;justify-content:center;font-size:2rem;flex-shrink:0;">💀</div>`
      }
      <div>
        ${m.categoria ? `<div style="font-size:.75rem;color:rgba(255,255,255,.4);margin-bottom:.15rem;">${m.categoria}${m.elemento ? ` · ${m.elemento}` : ""}</div>` : ""}
        <div style="font-size:.85rem;color:rgba(255,255,255,.6);">📍 ${m.map || "?"}</div>
      </div>
    </div>

    <hr style="border-color:rgba(255,255,255,.08);margin:.75rem 0;">

    <div style="display:grid;gap:.5rem;font-size:.82rem;">
      ${naviCmd ? `
      <div style="display:flex;align-items:center;gap:.5rem;">
        <span style="color:rgba(255,255,255,.5);flex-shrink:0;">📍 Tumba:</span>
        <code style="background:rgba(255,255,255,.06);padding:.15rem .4rem;border-radius:6px;font-size:.78rem;flex:1;word-break:break-all;">${naviCmd}</code>
        <button id="copy-navi-btn" onclick="copyNavi('${naviCmd}')"
          style="flex-shrink:0;padding:.2rem .5rem;border-radius:6px;border:1px solid rgba(99,102,241,.4);
                 background:rgba(99,102,241,.15);color:#a5b4fc;font-size:.72rem;cursor:pointer;">
          📋 Copiar
        </button>
      </div>
      ` : ""}

      <div style="display:flex;gap:.5rem;">
        <span style="color:rgba(255,255,255,.5);">💀 Muerte:</span>
        <span style="color:rgba(255,255,255,.8);">${fmtUtc(killedDate)}</span>
      </div>

      <div style="display:grid;gap:.2rem;">
        <div style="display:flex;gap:.5rem;">
          <span style="color:rgba(255,255,255,.5);">⏰ Respawn:</span>
          <span style="color:#a5f3fc;">${fmtLocal(respawnDate)}</span>
        </div>
        <div style="padding-left:4.5rem;font-size:.74rem;color:rgba(255,255,255,.3);">${fmtUtc(respawnDate)}</div>
      </div>

      ${m.hunter_name ? `
      <div style="display:flex;gap:.5rem;">
        <span style="color:rgba(255,255,255,.5);">👤 Registrado por:</span>
        <span style="color:rgba(255,255,255,.8);">${m.hunter_name}</span>
      </div>
      ` : ""}
    </div>
  `;

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("mvp-detail-modal"));
  modal.show();
}

function copyNavi(cmd) {
  navigator.clipboard.writeText(cmd).then(() => {
    const btn = document.getElementById("copy-navi-btn");
    if (!btn) return;
    btn.textContent = "✅ Copiado";
    setTimeout(() => { btn.textContent = "📋 Copiar"; }, 2000);
  }).catch(() => {});
}

// ── Countdowns ─────────────────────────────────────────────────────────────────

function startCountdowns() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    document.querySelectorAll(".mvp-countdown").forEach(el => {
      const respawn = el.dataset.respawn;
      if (!respawn) return;
      const diff = parseUtc(respawn) - new Date();
      el.textContent = fmtCountdown(diff);
    });
    updateRefreshBadge();
  }, 1000);
}

function updateRefreshBadge() {
  const badge = document.getElementById("refresh-badge");
  if (!lastRefresh || !badge) return;
  const sec = Math.round((new Date() - lastRefresh) / 1000);
  badge.textContent = `Actualizado hace ${sec}s`;
}

// ── Carga de datos ─────────────────────────────────────────────────────────────

async function loadMVPs() {
  try {
    const res = await fetch(`${API}/mvp`);
    if (!res.ok) throw new Error();
    allMVPs = await res.json();
    lastRefresh = new Date();
  } catch {
    document.getElementById("mvp-grid").innerHTML =
      `<div class="col-12 text-center py-5" style="color:rgba(255,255,255,.3);">Error al cargar MVPs.</div>`;
    return;
  }
  allMVPs.sort((a, b) => parseUtc(a.respawn_at) - parseUtc(b.respawn_at));
  renderMVPs(allMVPs);
  startCountdowns();
}

// ── Eventos ────────────────────────────────────────────────────────────────────

// Click en tarjeta → abrir modal
document.getElementById("mvp-grid").addEventListener("click", e => {
  const card = e.target.closest(".mvp-card");
  if (!card) return;
  const idx  = parseInt(card.dataset.mvpIdx, 10);
  const grid = document.getElementById("mvp-grid");
  const list = grid._filteredMVPs || allMVPs;
  if (list[idx]) openDetailModal(list[idx]);
});

// Filtros
document.querySelectorAll("[data-filter]").forEach(btn => {
  btn.addEventListener("click", () => {
    activeFilter = btn.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(b => {
      const on = b === btn;
      b.classList.toggle("btn-indigo", on && b.dataset.filter === "all");
      b.classList.toggle("active", on);
    });
    renderMVPs(allMVPs);
    startCountdowns();
  });
});

document.getElementById("refresh-btn")?.addEventListener("click", loadMVPs);

autoRefreshInterval = setInterval(loadMVPs, 30000);

loadMVPs();
