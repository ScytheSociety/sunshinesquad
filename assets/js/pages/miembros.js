import { getUser, apiFetch } from "/assets/js/auth.js";

const API = "https://sunshinesquad.es/api";

let allMembers = [];
let activeGame  = "";

function fmtPts(n) {
  return Number(n || 0).toLocaleString("es-ES");
}

async function loadMembers(game = "") {
  const grid = document.getElementById("members-grid");
  grid.innerHTML = `<div style="text-align:center;color:rgba(255,255,255,.3);padding:3rem;grid-column:1/-1;">Cargando…</div>`;

  try {
    const url = game ? `${API}/profile/members?game=${encodeURIComponent(game)}` : `${API}/profile/members`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    allMembers = await res.json();
  } catch {
    grid.innerHTML = `<div style="text-align:center;color:rgba(255,255,255,.3);padding:3rem;grid-column:1/-1;">Error al cargar miembros.</div>`;
    return;
  }

  renderMembers(allMembers);
}

function renderMembers(members) {
  const grid = document.getElementById("members-grid");
  if (!members.length) {
    grid.innerHTML = `<div class="member-card-empty">No hay miembros en este filtro.</div>`;
    return;
  }

  grid.innerHTML = members.map(m => `
    <a class="member-card" href="../../pages/perfil/perfil.html?id=${m.discord_id}">
      <img class="member-avatar" src="${m.avatar}" alt="${m.username}" loading="lazy"
           onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
      <div class="member-name">${m.display_name || m.username}</div>
      <div class="member-pts">${fmtPts(m.total_points)} pts</div>
      <div class="member-games">
        ${(m.games || []).map(g => `<span title="${g.name}">${g.emoji}</span>`).join("")}
      </div>
    </a>
  `).join("");
}

async function buildFilters() {
  try {
    const res = await fetch(`${API}/games`);
    if (!res.ok) return;
    const games = await res.json();
    const active = games.filter(g => g.activo !== 0);

    const bar = document.getElementById("filtros-juego");
    active.forEach(g => {
      const btn = document.createElement("button");
      btn.className = "btn btn-sm";
      btn.style.cssText = "background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);";
      btn.dataset.game = g.command_key || "";
      btn.innerHTML = `${g.emoji || "🎮"} ${g.nombre}`;
      bar.appendChild(btn);
    });
  } catch {}

  document.getElementById("filtros-juego").addEventListener("click", e => {
    const btn = e.target.closest("[data-game]");
    if (!btn) return;
    activeGame = btn.dataset.game;

    // Update active styles
    document.querySelectorAll("#filtros-juego button").forEach(b => {
      const isActive = b === btn;
      b.classList.toggle("btn-indigo", isActive);
      b.classList.toggle("active", isActive);
      if (!isActive) {
        b.style.cssText = "background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);";
      } else {
        b.style.cssText = "";
      }
    });

    loadMembers(activeGame);
  });
}

function renderMiPerfilBtn() {
  const user = getUser();
  const wrap = document.getElementById("mi-perfil-btn-wrap");
  if (user) {
    wrap.innerHTML = `<a href="../../pages/perfil/perfil.html?id=${user.id}" class="btn btn-indigo btn-sm">👤 Mi perfil</a>`;
  }
}

buildFilters();
loadMembers();
renderMiPerfilBtn();
