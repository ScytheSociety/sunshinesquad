// Admin Dashboard — home
import { getUser, apiFetch } from "../auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = getUser();

  if (!user || !["admin","moderador","editor"].includes(user.role)) {
    document.getElementById("access-denied").style.display = "block";
    document.getElementById("admin-sections").style.display = "none";
    document.getElementById("admin-user-label").textContent = user ? "Sin permisos suficientes" : "No autenticado";
    return;
  }

  document.getElementById("admin-sections").style.display = "block";
  document.getElementById("admin-user-label").textContent = `Bienvenido, ${user.username}`;
  const roleLabel = { admin:"Admin", moderador:"Moderador", editor:"Editor" }[user.role] || user.role;
  const badge = document.getElementById("admin-role-badge");
  if (badge) badge.textContent = roleLabel;

  loadStats();
});

async function loadStats() {
  const results = await Promise.allSettled([
    apiFetch("/health").then(r => r?.json()),
    apiFetch("/games").then(r => r?.json()),
    apiFetch("/schedule/all").then(r => r?.json()),
    apiFetch("/streams").then(r => r?.json()),
    apiFetch("/blog?page=1&limit=1").then(r => r?.json()),
    // Catalog items (sum across games)
    Promise.all(["ragnarok","wow","lineage2","brawlstars","throneandliberty"].map(g =>
      apiFetch(`/tl-catalog/${g}/items`).then(r => r?.json()).catch(() => [])
    )),
  ]);

  const [health, games, schedule, streams, blog, catalogs] = results.map(r => r.status === "fulfilled" ? r.value : null);

  // API status
  const apiEl = document.getElementById("stat-api");
  const apiCont = document.getElementById("stat-api-container");
  if (health?.ok) {
    if (apiEl) apiEl.textContent = "OK";
    if (apiCont) apiCont.style.borderColor = "rgba(34,197,94,.35)";
    if (apiEl) apiEl.style.color = "#86efac";
  } else {
    if (apiEl) apiEl.textContent = "ERR";
    if (apiCont) apiCont.style.borderColor = "rgba(239,68,68,.35)";
    if (apiEl) apiEl.style.color = "#fca5a5";
  }

  setVal("stat-games",   Array.isArray(games) ? games.length : "?");
  setVal("stat-events",  schedule?.eventos?.length ?? "?");
  setVal("stat-streams", streams?.channels?.length ?? "?");
  setVal("stat-posts",   blog?.total ?? "?");

  if (Array.isArray(catalogs)) {
    const total = catalogs.flat().reduce((s, items) => s + (Array.isArray(items) ? items.length : 0), 0);
    setVal("stat-items", total);
  }
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}
