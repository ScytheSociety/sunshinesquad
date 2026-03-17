const API = "https://sunshinesquad.es/api";

let allMVPs   = [];
let activeFilter = "all";
let countdownInterval = null;
let autoRefreshInterval = null;
let lastRefresh = null;

function fmtCountdown(ms) {
  if (ms <= 0) return "¡Spawneando!";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${String(m).padStart(2,"0")}m`);
  parts.push(`${String(s).padStart(2,"0")}s`);
  return parts.join(" ");
}

function getStatus(respawnAt) {
  const diff = new Date(respawnAt) - new Date();
  if (diff <= 0)          return "spawning";
  if (diff < 30 * 60000)  return "soon";
  return "waiting";
}

function statusConfig(status) {
  const cfg = {
    spawning: { label: "¡Disponible!",  dot: "#22c55e", badge: "rgba(34,197,94,.15)",  border: "rgba(34,197,94,.35)",  color: "#86efac"  },
    soon:     { label: "Pronto",         dot: "#fbbf24", badge: "rgba(251,191,36,.1)",  border: "rgba(251,191,36,.3)",  color: "#fcd34d"  },
    waiting:  { label: "En cooldown",    dot: "#6b7280", badge: "rgba(107,114,128,.1)", border: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.4)" },
  };
  return cfg[status] || cfg.waiting;
}

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
    const status = getStatus(m.respawn_at);
    const cfg    = statusConfig(status);
    const diff   = new Date(m.respawn_at) - new Date();
    return `
      <div class="col-sm-6 col-lg-4">
        <div style="background:rgba(255,255,255,.03);border:1px solid ${cfg.border};border-radius:16px;padding:1rem;height:100%;">
          <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.75rem;">
            ${m.image_url
              ? `<img src="${m.image_url}" alt="${m.boss_name}" width="56" height="56"
                      style="border-radius:12px;object-fit:contain;background:rgba(255,255,255,.04);flex-shrink:0;" loading="lazy">`
              : `<div style="width:56px;height:56px;border-radius:12px;background:rgba(99,102,241,.12);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">💀</div>`
            }
            <div style="flex:1;min-width:0;">
              <div style="font-weight:800;font-size:.95rem;color:#fff;margin-bottom:.2rem;">${m.boss_name}</div>
              <div style="font-size:.72rem;color:rgba(255,255,255,.35);">📍 ${m.map || "?"}</div>
              ${m.hora_respawn ? `<div style="font-size:.68rem;color:rgba(255,255,255,.25);">⏱ Ventana: ${m.hora_respawn}</div>` : ""}
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;">
            <span style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.4px;
                         padding:.2rem .6rem;border-radius:999px;background:${cfg.badge};
                         border:1px solid ${cfg.border};color:${cfg.color};">
              ${cfg.label}
            </span>
            <span class="mvp-countdown" data-idx="${idx}" data-respawn="${m.respawn_at}"
                  style="font-size:1rem;font-weight:900;font-variant-numeric:tabular-nums;color:${cfg.color};">
              ${fmtCountdown(diff)}
            </span>
          </div>
          ${m.navigation ? `<div style="margin-top:.5rem;font-size:.7rem;color:rgba(255,255,255,.25);">🗺 ${m.navigation}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function startCountdowns() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    document.querySelectorAll(".mvp-countdown").forEach(el => {
      const respawn = el.dataset.respawn;
      if (!respawn) return;
      const diff = new Date(respawn) - new Date();
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

  // Sort by closest respawn
  allMVPs.sort((a, b) => new Date(a.respawn_at) - new Date(b.respawn_at));
  renderMVPs(allMVPs);
  startCountdowns();
}

// Filters
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

// Manual refresh
document.getElementById("refresh-btn")?.addEventListener("click", () => {
  loadMVPs();
});

// Auto-refresh every 30s
autoRefreshInterval = setInterval(loadMVPs, 30000);

loadMVPs();
