import { getUser, apiFetch } from "/assets/js/auth.js";
import { isPushSupported, isPushSubscribed, subscribeToPush, unsubscribeFromPush } from "/assets/js/push-manager.js";

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
  const setMeta = (sel, val) => { const el = document.querySelector(sel); if (el) el.setAttribute("content", val); };
  const profileUrl = `https://sunshinesquad.es/pages/perfil/perfil.html?id=${p.discord_id}`;
  setMeta('meta[property="og:title"]',       `${p.display_name || p.username} · Sunshine Squad`);
  setMeta('meta[property="og:description"]', `Perfil de ${p.display_name || p.username} en la comunidad Sunshine Squad.`);
  setMeta('meta[property="og:image"]',       p.avatar || "https://i.imgur.com/p7OlADi.gif");
  setMeta('meta[property="og:url"]',         profileUrl);

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
  const isOwn = !!(me && me.id === p.discord_id);

  // Apply banner
  const headerEl = document.getElementById("perfil-header");
  if (p.banner_url && headerEl) {
    headerEl.style.backgroundImage = `url('${p.banner_url}')`;
    headerEl.classList.add("has-banner");
  }

  // Banner edit button (own profile only)
  const bannerBtn = document.getElementById("p-banner-btn");
  if (isOwn && bannerBtn) {
    bannerBtn.style.display = "";
    bannerBtn.addEventListener("click", () => showBannerModal(p.banner_url));
  }

  // Init push section if own profile
  initPushSection(isOwn);

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

// ── Banner modal ───────────────────────────────────────────────────
function showBannerModal(currentUrl) {
  const existing = document.getElementById("banner-modal-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "banner-modal-overlay";
  overlay.className = "banner-modal-overlay";
  overlay.innerHTML = `
    <div class="banner-modal-box">
      <div class="banner-modal-title">🖼️ Banner de perfil</div>
      <div class="banner-modal-sub">Pega la URL de una imagen para usar como fondo de tu perfil. Se recomienda 1200×300 px o similar.</div>
      <input id="banner-url-input" type="url" class="form-control mb-3" placeholder="https://ejemplo.com/imagen.jpg" value="${currentUrl || ''}">
      <div id="banner-preview-wrap" style="display:${currentUrl ? 'block' : 'none'};margin-bottom:.75rem;border-radius:10px;overflow:hidden;height:80px;background-size:cover;background-position:center;border:1px solid rgba(255,255,255,.1);background-image:url('${currentUrl || ''}');"></div>
      <div class="d-flex gap-2 flex-wrap">
        <button id="banner-save-btn" class="btn-indigo flex-fill">Guardar</button>
        ${currentUrl ? '<button id="banner-remove-btn" class="btn-ss flex-fill" style="color:#fca5a5;border-color:rgba(239,68,68,.3);">Quitar banner</button>' : ''}
        <button id="banner-cancel-btn" class="btn-ss" style="width:auto;padding:.45rem .9rem;">✕</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.querySelector("#banner-cancel-btn").onclick = () => overlay.remove();

  // Live preview
  const input = overlay.querySelector("#banner-url-input");
  const preview = overlay.querySelector("#banner-preview-wrap");
  input.addEventListener("input", () => {
    const v = input.value.trim();
    if (v) { preview.style.backgroundImage = `url('${v}')`; preview.style.display = "block"; }
    else    { preview.style.display = "none"; }
  });

  overlay.querySelector("#banner-save-btn").onclick = async () => {
    const url = input.value.trim();
    await saveBanner(url);
    overlay.remove();
  };

  const removeBtn = overlay.querySelector("#banner-remove-btn");
  if (removeBtn) removeBtn.onclick = async () => {
    await saveBanner("");
    overlay.remove();
  };
}

async function saveBanner(url) {
  const res = await apiFetch("/profile/banner", {
    method: "PUT",
    body: JSON.stringify({ banner_url: url || null }),
  });
  if (res?.ok) {
    const headerEl = document.getElementById("perfil-header");
    if (!headerEl) return;
    if (url) {
      headerEl.style.backgroundImage = `url('${url}')`;
      headerEl.classList.add("has-banner");
    } else {
      headerEl.style.backgroundImage = "";
      headerEl.classList.remove("has-banner");
    }
  }
}

// ── Push preferences (own profile only) ───────────────────────────
const PREFS_DEF = [
  { key: "pref_blog",     label: "📝 Blog",          desc: "Nuevos posts publicados" },
  { key: "pref_event",    label: "📅 Eventos",        desc: "Nuevos eventos en el horario" },
  { key: "pref_birthday", label: "🎂 Cumpleaños",     desc: "Cumpleaños de miembros" },
  { key: "pref_tierlist", label: "🏅 Tier Lists",     desc: "Nuevas tier lists" },
];

async function initPushSection(isOwn) {
  if (!isOwn) return;
  const section = document.getElementById("p-push-section");
  if (!section) return;
  section.style.display = "";

  const statusEl  = document.getElementById("p-push-status");
  const prefsEl   = document.getElementById("p-push-prefs");
  const togglesEl = document.getElementById("p-prefs-toggles");
  const btnWrap   = document.getElementById("p-push-btn-wrap");

  if (!isPushSupported()) {
    statusEl.textContent = "Tu navegador no soporta notificaciones push.";
    return;
  }

  const perm      = Notification.permission;
  const subscribed = await isPushSubscribed();
  const user       = getUser();

  // Status label
  if (perm === "denied") {
    statusEl.innerHTML = `<span style="color:#fca5a5;">🚫 Notificaciones bloqueadas en tu navegador. Habilítalas en Configuración.</span>`;
  } else if (subscribed) {
    statusEl.innerHTML = `<span style="color:#86efac;">✅ Notificaciones activadas en este dispositivo.</span>`;
  } else {
    statusEl.innerHTML = `<span style="color:rgba(255,255,255,.4);">🔕 Notificaciones desactivadas.</span>`;
  }

  // Preference toggles (only when subscribed)
  if (subscribed && user) {
    prefsEl.style.display = "";
    let prefs = { pref_blog:1, pref_event:1, pref_birthday:1, pref_tierlist:0 };
    try {
      const res = await apiFetch("/push/preferences");
      if (res && res.ok) prefs = await res.json();
    } catch {}

    togglesEl.innerHTML = PREFS_DEF.map(p => `
      <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;
                    background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
                    border-radius:10px;padding:.5rem .75rem;font-size:.83rem;color:rgba(255,255,255,.75);">
        <input type="checkbox" data-key="${p.key}" ${prefs[p.key] ? "checked" : ""}
               style="accent-color:#6366f1;width:16px;height:16px;">
        <span>${p.label}</span>
        <span style="font-size:.72rem;color:rgba(255,255,255,.35);">${p.desc}</span>
      </label>
    `).join("");

    // Save on change
    togglesEl.addEventListener("change", async () => {
      const updated = {};
      PREFS_DEF.forEach(p => {
        updated[p.key] = togglesEl.querySelector(`[data-key="${p.key}"]`)?.checked ? 1 : 0;
      });
      await apiFetch("/push/preferences", { method:"PUT", body: JSON.stringify(updated) });
    });
  }

  // Subscribe / Unsubscribe button
  const btn = document.createElement("button");
  btn.className = "btn btn-sm";
  if (subscribed) {
    btn.style.cssText = "background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fca5a5;";
    btn.textContent   = "🔕 Desactivar notificaciones";
    btn.onclick = async () => {
      btn.disabled = true;
      await unsubscribeFromPush();
      initPushSection(true); // reload
    };
  } else if (perm !== "denied") {
    btn.style.cssText = "background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.35);color:#a5b4fc;";
    btn.textContent   = "🔔 Activar notificaciones";
    btn.onclick = async () => {
      btn.disabled     = true;
      btn.textContent  = "Activando…";
      try {
        await subscribeToPush(user?.id);
        initPushSection(true);
      } catch (err) {
        btn.disabled    = false;
        btn.textContent = "🔔 Activar notificaciones";
        statusEl.innerHTML = `<span style="color:#fca5a5;">${err.message}</span>`;
      }
    };
  }
  if (perm !== "denied") btnWrap.appendChild(btn);
}
