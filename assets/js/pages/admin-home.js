// Admin Dashboard — home
import { getUser } from "../auth.js";

const API = "https://sunshinesquad.es/api";

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

  // Cargar stats
  loadStats();
});

async function loadStats() {
  const token = localStorage.getItem("ss_token");
  const h = token ? { Authorization: `Bearer ${token}` } : {};

  const games = ["ragnarok","wow","lineage2","brawlstars","throneandliberty"];

  // Contar items de catálogo
  let totalItems = 0, totalRoles = 0;
  await Promise.all(games.map(async g => {
    try {
      const [ir, rr] = await Promise.all([
        fetch(`${API}/tl-catalog/${g}/items`).then(r => r.json()),
        fetch(`${API}/tl-catalog/${g}/roles`).then(r => r.json()),
      ]);
      totalItems += ir.length || 0;
      totalRoles += rr.length || 0;
    } catch {}
  }));

  setVal("stat-items", totalItems);
  setVal("stat-roles", totalRoles);

  // Blog posts
  try {
    const br = await fetch(`${API}/blog?page=1&limit=1`).then(r => r.json());
    setVal("stat-posts", br.total ?? "?");
  } catch { setVal("stat-posts", "?"); }

  setVal("stat-tierlists", "–");
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}
