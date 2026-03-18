import { loadText, loadJson, repoRoot } from "./app.js";
import { renderAuthButton, getUser } from "./auth.js";

async function loadComponent(id, path) {
  try {
    let html = await loadText(path);
    html = html.replaceAll("{{ROOT}}", repoRoot());
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  } catch(e) {
    console.error("Error cargando componente:", path, e);
  }
}

async function loadNavJuegos() {
  const list = document.getElementById("nav-juegos-list");
  if (!list) return;

  let juegos = [];
  try {
    // Intentar desde API primero
    const res = await fetch("https://sunshinesquad.es/api/games", { cache: "no-store" });
    if (res.ok) {
      juegos = await res.json();
    } else {
      throw new Error("API no disponible");
    }
  } catch {
    try {
      // Fallback a JSON estático
      const data = await loadJson("data/games.json");
      juegos = data.juegos || [];
    } catch(e) {
      console.error("Error cargando juegos en navbar:", e);
      return;
    }
  }

  juegos.forEach(j => {
    if (j.activo === 0) return; // ocultar inactivos
    let badges = "";
    if (j.guild) badges += `<span style="font-size:.65rem;background:rgba(234,179,8,.18);border:1px solid rgba(234,179,8,.4);color:#fde047;border-radius:999px;padding:.1rem .4rem;margin-left:4px;">GUILD</span>`;
    if (j.serie) badges += `<span style="font-size:.65rem;background:rgba(168,85,247,.18);border:1px solid rgba(168,85,247,.4);color:#d8b4fe;border-radius:999px;padding:.1rem .4rem;margin-left:4px;">SERIE</span>`;

    const li = document.createElement("li");
    li.innerHTML = `
      <a class="dropdown-item" href="${repoRoot() + j.url}"
         style="border-radius:8px;color:rgba(255,255,255,.75);font-size:.85rem;padding:.45rem .75rem;text-decoration:none;display:flex;align-items:center;justify-content:space-between;transition:background .15s;"
         onmouseover="this.style.background='rgba(255,255,255,.07)'"
         onmouseout="this.style.background='transparent'">
        <span>${j.nombre}</span>
        <span>${badges}</span>
      </a>
    `;
    list.appendChild(li);
  });
}

function setYear() {
  const el = document.getElementById("footer-year");
  if (el) el.textContent = new Date().getFullYear();
}

function injectPWAMeta() {
  const head = document.head;

  // Web App Manifest
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement("link");
    manifest.rel  = "manifest";
    manifest.href = "/manifest.json";
    head.appendChild(manifest);
  }

  // Theme color
  if (!document.querySelector('meta[name="theme-color"]')) {
    const tc = document.createElement("meta");
    tc.name    = "theme-color";
    tc.content = "#6366f1";
    head.appendChild(tc);
  }

  // Apple PWA metas
  if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
    const amc = document.createElement("meta");
    amc.name    = "apple-mobile-web-app-capable";
    amc.content = "yes";
    head.appendChild(amc);

    const ams = document.createElement("meta");
    ams.name    = "apple-mobile-web-app-status-bar-style";
    ams.content = "black-translucent";
    head.appendChild(ams);

    const amt = document.createElement("meta");
    amt.name    = "apple-mobile-web-app-title";
    amt.content = "Sunshine Squad";
    head.appendChild(amt);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  injectPWAMeta();
  await loadComponent("navbar-container", "components/navbar.html");
  await loadComponent("footer-container", "components/footer.html");
  await loadNavJuegos();
  setYear();
  renderAuthButton("auth-btn-container");

  // Mostrar enlace admin si tiene permisos
  const user = getUser();
  if (user && ["admin","moderador","editor"].includes(user.role)) {
    const adminLink = document.getElementById("nav-admin-link");
    if (adminLink) adminLink.style.display = "";
  }
});