import { getUser, apiFetch } from "/assets/js/auth.js";

const ROLE_LVL = { admin:4, moderador:3, editor:2, miembro:1, visitante:0 };

const FIELDS = [
  "clan_name", "clan_description",
  "clan_discord", "clan_twitch", "clan_youtube", "clan_twitter", "clan_tiktok",
  "announcement", "announcement_type",
];

const ANNOUNCE_COLORS = {
  info:    { bg:"rgba(99,102,241,.15)", border:"rgba(99,102,241,.3)", color:"#a5b4fc" },
  success: { bg:"rgba(34,197,94,.12)",  border:"rgba(34,197,94,.3)",  color:"#86efac" },
  warning: { bg:"rgba(251,191,36,.12)", border:"rgba(251,191,36,.3)", color:"#fde047" },
  danger:  { bg:"rgba(239,68,68,.12)",  border:"rgba(239,68,68,.3)",  color:"#fca5a5" },
};

function updatePreview() {
  const text   = document.getElementById("cfg-announcement").value.trim();
  const type   = document.getElementById("cfg-announcement_type").value;
  const active = document.getElementById("cfg-announcement_active").checked;
  const prev   = document.getElementById("announcement-preview");

  if (!text || !active) { prev.style.display = "none"; return; }

  const c = ANNOUNCE_COLORS[type] || ANNOUNCE_COLORS.info;
  prev.style.display    = "";
  prev.style.background = c.bg;
  prev.style.border     = `1px solid ${c.border}`;
  prev.style.color      = c.color;
  prev.textContent      = `📢 ${text}`;
}

async function load() {
  const res = await apiFetch("/config");
  if (!res || !res.ok) return;
  const cfg = await res.json();

  FIELDS.forEach(k => {
    const el = document.getElementById(`cfg-${k}`);
    if (el) el.value = cfg[k] || "";
  });

  document.getElementById("cfg-announcement_active").checked = cfg.announcement_active === "1";
  updatePreview();
}

async function save() {
  const btn   = document.getElementById("save-btn");
  const alert = document.getElementById("save-alert");
  btn.disabled    = true;
  btn.textContent = "Guardando…";

  const body = {};
  FIELDS.forEach(k => {
    const el = document.getElementById(`cfg-${k}`);
    if (el) body[k] = el.value.trim();
  });
  body.announcement_active = document.getElementById("cfg-announcement_active").checked ? "1" : "0";

  const res = await apiFetch("/config", { method: "PUT", body: JSON.stringify(body) });

  btn.disabled    = false;
  btn.textContent = "💾 Guardar cambios";

  alert.style.display = "";
  if (res && res.ok) {
    alert.style.background = "rgba(34,197,94,.12)";
    alert.style.border     = "1px solid rgba(34,197,94,.3)";
    alert.style.color      = "#86efac";
    alert.textContent      = "✅ Configuración guardada correctamente.";
  } else {
    const d = res ? await res.json() : {};
    alert.style.background = "rgba(239,68,68,.12)";
    alert.style.border     = "1px solid rgba(239,68,68,.3)";
    alert.style.color      = "#fca5a5";
    alert.textContent      = `❌ Error: ${d.error || "desconocido"}`;
  }

  setTimeout(() => alert.style.display = "none", 4000);
}

document.addEventListener("DOMContentLoaded", () => {
  const user = getUser();
  if (!user || (ROLE_LVL[user.role] || 0) < 4) {
    document.getElementById("access-denied").style.display = "";
    return;
  }
  document.getElementById("config-content").style.display = "";
  load();

  document.getElementById("save-btn").addEventListener("click", save);

  // Live preview
  document.getElementById("cfg-announcement").addEventListener("input", updatePreview);
  document.getElementById("cfg-announcement_type").addEventListener("change", updatePreview);
  document.getElementById("cfg-announcement_active").addEventListener("change", updatePreview);
});
