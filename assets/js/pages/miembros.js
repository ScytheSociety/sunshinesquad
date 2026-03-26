import { getUser, apiFetch } from "/assets/js/auth.js";

const API = "https://sunshinesquad.es/api";

function gameIconHtml(g, size = 20) {
  const url = g.site_icon_url || g.icon_url || null;
  if (url) return `<img src="${url}" alt="${g.name || ''}" title="${g.name || ''}"
    style="width:${size}px;height:${size}px;object-fit:contain;border-radius:3px;vertical-align:middle;"
    onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${g.emoji || '🎮'}',title:'${g.name || ''}'}))">`;
  return `<span title="${g.name || ''}">${g.emoji || '🎮'}</span>`;
}

let allMembers  = [];
let activeGame  = "";
let gamesIndex  = {};  // command_key → game object (populated in buildFilters)

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

  grid.innerHTML = members.map(m => {
    // Bottom section: when filtered by game show main char + game icon, else show all game icons
    let bottomHtml;
    if (activeGame) {
      const gameObj = gamesIndex[activeGame] || null;
      const mc = m.main_character;
      const iconHtml = gameObj ? gameIconHtml(gameObj, 18) : "";
      const charText = mc
        ? `${mc.class_emoji ? `${mc.class_emoji} ` : ""}${mc.character_name}${mc.level ? ` · Nv ${mc.level}` : ""}`
        : "Sin personaje";
      bottomHtml = `
        <div class="member-games" style="align-items:center;gap:5px;">
          ${iconHtml}
          <span style="font-size:.72rem;color:rgba(255,255,255,.55);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${charText}</span>
        </div>`;
    } else {
      bottomHtml = `
        <div class="member-games">
          ${(m.games || []).map(g => `<span style="cursor:pointer;" data-game-key="${g.command_key}">${gameIconHtml(g, 22)}</span>`).join("")}
        </div>`;
    }

    return `
      <a class="member-card" href="/pages/perfil/perfil.html?id=${m.discord_id}">
        <img class="member-avatar" src="${m.avatar}" alt="${m.username}" loading="lazy"
             onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        <div class="member-name">${m.display_name || m.username}</div>
        <div class="member-pts">${fmtPts(m.total_points)} pts</div>
        ${bottomHtml}
      </a>`;
  }).join("");
}

async function buildFilters() {
  try {
    const res = await fetch(`${API}/games`);
    if (!res.ok) return;
    const games = await res.json();
    // Solo juegos registrados en el bot (tienen command_key)
    const active = games.filter(g => g.activo !== 0 && g.command_key);

    // Build index for icon lookups in renderMembers
    active.forEach(g => { gamesIndex[g.command_key] = g; });

    const bar = document.getElementById("filtros-juego");
    active.forEach(g => {
      const btn = document.createElement("button");
      btn.className = "btn btn-sm";
      btn.style.cssText = "background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);";
      btn.dataset.game = g.command_key;
      btn.innerHTML = `${gameIconHtml(g, 18)} ${g.nombre}`;
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
    wrap.innerHTML = `<a href="/pages/perfil/perfil.html?id=${user.id}" class="btn btn-indigo btn-sm">👤 Mi perfil</a>`;
  }
}

document.getElementById("members-grid")?.addEventListener("click", e => {
  const span = e.target.closest("[data-game-key]");
  if (!span) return;
  const key = span.dataset.gameKey;
  if (!key) return;
  activeGame = key;
  document.querySelectorAll("#filtros-juego [data-game]").forEach(b => {
    const on = b.dataset.game === key;
    b.classList.toggle("btn-indigo", on);
    b.classList.toggle("active", on);
    if (!on) b.style.cssText = "background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);";
    else b.style.cssText = "";
  });
  loadMembers(key);
});

buildFilters();
loadMembers();
renderMiPerfilBtn();
