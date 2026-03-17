import { getUser, apiFetch } from "/assets/js/auth.js";

const API = "https://sunshinesquad.es/api";

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day:"2-digit", month:"short", year:"numeric" });
}

function fmtPts(n) {
  if (n == null) return "0";
  return Number(n).toLocaleString("es-ES");
}

async function loadProfile() {
  // Determine which discord_id to show
  // Priority: ?id=xxx → own profile if logged in → not-found
  const params = new URLSearchParams(location.search);
  const discordId = params.get("id");

  const loading     = document.getElementById("perfil-loading");
  const notFound    = document.getElementById("perfil-not-found");
  const content     = document.getElementById("perfil-content");

  let profile = null;

  try {
    if (discordId) {
      const res = await fetch(`${API}/profile/${discordId}`);
      if (res.ok) profile = await res.json();
    } else {
      // Try own profile if logged in
      const user = getUser();
      if (user) {
        const res = await apiFetch("/profile/me");
        if (res && res.ok) profile = await res.json();
      }
    }
  } catch {}

  loading.style.display = "none";

  if (!profile) {
    notFound.style.display = "";
    // Update page title
    document.title = "Perfil no encontrado · Sunshine Squad";
    return;
  }

  renderProfile(profile);
  content.style.display = "";
}

function renderProfile(p) {
  // Update meta
  document.title = `${p.username} · Sunshine Squad`;

  // Header
  document.getElementById("p-avatar").src = p.avatar;
  document.getElementById("p-avatar").alt = p.username;
  document.getElementById("p-name").textContent = p.display_name || p.username;

  const sub = document.getElementById("p-sub");
  const parts = [];
  if (p.username) parts.push(`@${p.username}`);
  if (p.timezone) parts.push(p.timezone);
  sub.textContent = parts.join(" · ");

  // Role badge from logged-in user comparison
  const me = getUser();
  if (me && me.id === p.discord_id && me.role && me.role !== "visitante") {
    const roleBadge = document.getElementById("p-role");
    const roleLabels = { admin:"Admin", moderador:"Moderador", editor:"Editor", miembro:"Miembro" };
    roleBadge.textContent = roleLabels[me.role] || me.role;
    roleBadge.style.display = "";
  }

  // Stats strip
  const statsEl = document.getElementById("p-stats");
  const statsData = [
    { val: fmtPts(p.total_points), lbl: "Puntos totales" },
    { val: p.rank ? `#${p.rank}` : "—", lbl: "Ranking" },
    { val: p.game_stats?.length || 0, lbl: "Juegos" },
    { val: p.characters?.length || 0, lbl: "Personajes" },
    { val: p.achievements?.length || 0, lbl: "Logros" },
    { val: p.events_attended?.length || 0, lbl: "Eventos" },
  ];
  statsEl.innerHTML = statsData.map(s => `
    <div class="perfil-stat">
      <div class="perfil-stat-val">${s.val}</div>
      <div class="perfil-stat-lbl">${s.lbl}</div>
    </div>
  `).join("");

  // Games
  if (p.game_stats?.length) {
    document.getElementById("p-games-section").style.display = "";
    document.getElementById("p-games").innerHTML = p.game_stats.map(g => `
      <div class="col-sm-6">
        <div class="game-stat-card">
          <span class="game-stat-emoji">${g.emoji}</span>
          <div>
            <div class="game-stat-name">${g.name}</div>
            <div class="game-stat-pts">${g.abbreviation || ""} · <span>${fmtPts(g.points)} pts</span></div>
          </div>
        </div>
      </div>
    `).join("");
  }

  // Characters
  if (p.characters?.length) {
    document.getElementById("p-chars-section").style.display = "";
    document.getElementById("p-chars").innerHTML = p.characters.map(c => `
      <div class="col-sm-6">
        <div class="char-card">
          ${c.is_main ? '<span class="char-main-badge">Main</span>' : ""}
          <div class="char-avatar">${(c.class_emoji || c.character_name[0] || "?").slice(0,2)}</div>
          <div style="min-width:0;">
            <div class="char-name">${c.character_name}</div>
            <div class="char-meta">
              ${c.game_name} · Nv ${c.level || "?"}
              ${c.class_name ? ` · ${c.class_name}` : ""}
              ${c.clan_name ? ` · <em>${c.clan_name}</em>` : ""}
            </div>
          </div>
        </div>
      </div>
    `).join("");
  }

  // Achievements
  if (p.achievements?.length) {
    document.getElementById("p-achievements-section").style.display = "";
    document.getElementById("p-achievements").innerHTML = p.achievements.map(a => `
      <div class="col-12">
        <div class="achievement-badge">
          <span class="achievement-emoji">${a.emoji}</span>
          <div>
            <div class="achievement-name">${a.name}</div>
            <div class="achievement-desc">${a.description || ""}</div>
            <div class="achievement-pts">+${fmtPts(a.points)} pts · ${a.game_name}</div>
          </div>
        </div>
      </div>
    `).join("");
  }

  // Events attended
  if (p.events_attended?.length) {
    document.getElementById("p-events-section").style.display = "";
    document.getElementById("p-events").innerHTML = p.events_attended.map(e => `
      <div class="event-row">
        <span class="event-game-tag">${e.command_key || e.game_name}</span>
        <span class="event-name">${e.name}</span>
        <span class="event-date">${fmtDate(e.event_datetime)}</span>
      </div>
    `).join("");
  }
}

loadProfile();
