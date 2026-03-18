const API = "https://sunshinesquad.es/api";

const PODIO_COLORS = [
  { border: "#fbbf24", bg: "rgba(251,191,36,.08)", label: "#fbbf24", medal: "🥇" },
  { border: "rgba(156,163,175,1)", bg: "rgba(156,163,175,.08)", label: "#9ca3af", medal: "🥈" },
  { border: "#cd7c2f", bg: "rgba(205,124,47,.08)", label: "#cd7c2f", medal: "🥉" },
];

function fmtPts(n) { return Number(n || 0).toLocaleString("es-ES"); }

let activeGame = "";

async function loadRanking(game = "") {
  const tableEl = document.getElementById("ranking-table");
  const podioEl = document.getElementById("podio");
  const podioRow = document.getElementById("podio-row");
  tableEl.innerHTML = `<div class="text-center py-5" style="color:rgba(255,255,255,.3);">Cargando…</div>`;
  podioEl.style.display = "none";

  const url = game
    ? `${API}/ranking?limit=50&game=${encodeURIComponent(game)}`
    : `${API}/ranking?limit=50`;

  let data = [];
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    data = await res.json();
  } catch {
    tableEl.innerHTML = `<div class="text-center py-4" style="color:rgba(255,255,255,.3);">Error al cargar el ranking.</div>`;
    return;
  }

  if (!data.length) {
    tableEl.innerHTML = `<div class="text-center py-4" style="color:rgba(255,255,255,.3);">Sin datos en este ranking.</div>`;
    return;
  }

  // Podio (top 3)
  const top3 = data.slice(0, 3);
  podioRow.innerHTML = top3.map((u, i) => {
    const c = PODIO_COLORS[i];
    const bgStyle = u.banner_url
      ? `background-image:linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.68)),url(${u.banner_url});background-size:cover;background-position:center;`
      : `background:${c.bg};`;
    return `
      <div class="col-sm-4 col-6 ${i === 0 ? "" : ""}">
        <a href="../../pages/perfil/perfil.html?id=${u.discord_id}"
           style="display:flex;flex-direction:column;align-items:center;gap:.5rem;padding:1.5rem 1rem;
                  ${bgStyle}border:1px solid ${c.border};border-radius:16px;text-decoration:none;">
          <span style="font-size:1.6rem;">${c.medal}</span>
          <img src="${u.avatar_url}" alt="${u.username}" width="${i===0?60:48}" height="${i===0?60:48}"
               style="border-radius:50%;border:2px solid ${c.border};object-fit:cover;"
               onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
          <div style="font-weight:800;font-size:.9rem;color:#fff;text-align:center;">${u.username}</div>
          <div style="font-size:1rem;font-weight:900;color:${c.label};">${fmtPts(u.puntos_totales)} pts</div>
          <div style="display:flex;gap:.25rem;flex-wrap:wrap;justify-content:center;">
            ${u.juegos.slice(0,3).map(g => `<span title="${g.game}" style="font-size:.85rem;">${g.emoji}</span>`).join("")}
          </div>
        </a>
      </div>
    `;
  }).join("");
  podioEl.style.display = "";

  // Full table (from position 4 onwards for display, but show all in table)
  tableEl.innerHTML = `
    <div class="perfil-section-title mb-3">Clasificación completa</div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,.08);font-size:.72rem;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.4px;">
            <th style="padding:.5rem .75rem;text-align:left;">#</th>
            <th style="padding:.5rem .75rem;text-align:left;">Jugador</th>
            <th style="padding:.5rem .75rem;text-align:right;">Puntos</th>
            <th style="padding:.5rem .75rem;text-align:left;min-width:80px;">Juegos</th>
          </tr>
        </thead>
        <tbody id="ranking-tbody">
          ${data.map((u, i) => {
            const medal = i < 3 ? PODIO_COLORS[i].medal : "";
            return `
              <tr style="border-bottom:1px solid rgba(255,255,255,.04);transition:background .12s;"
                  onmouseover="this.style.background='rgba(255,255,255,.03)'"
                  onmouseout="this.style.background=''">
                <td style="padding:.6rem .75rem;font-weight:800;font-size:.9rem;color:rgba(255,255,255,.4);width:36px;">
                  ${medal || `<span style="color:rgba(255,255,255,.25);">${u.posicion}</span>`}
                </td>
                <td style="padding:.6rem .75rem;">
                  <a href="../../pages/perfil/perfil.html?id=${u.discord_id}"
                     style="display:flex;align-items:center;gap:.6rem;text-decoration:none;">
                    <img src="${u.avatar_url}" alt="${u.username}" width="32" height="32"
                         style="border-radius:50%;object-fit:cover;border:1.5px solid rgba(255,255,255,.15);flex-shrink:0;"
                         onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                    <span style="font-weight:700;font-size:.88rem;color:#fff;">${u.username}</span>
                  </a>
                </td>
                <td style="padding:.6rem .75rem;text-align:right;font-weight:900;font-size:.95rem;color:#fbbf24;">
                  ${fmtPts(u.puntos_totales)}
                </td>
                <td style="padding:.6rem .75rem;">
                  <div style="display:flex;gap:.2rem;flex-wrap:wrap;">
                    ${u.juegos.slice(0,4).map(g => `<span title="${g.game} · ${fmtPts(g.points)} pts" style="font-size:.88rem;">${g.emoji}</span>`).join("")}
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

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

    loadRanking(activeGame);
  });
}

buildFilters();
loadRanking();
