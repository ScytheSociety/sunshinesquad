import { loadText, loadJson, repoRoot } from "./app.js";

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
  try {
    const data = await loadJson("data/games.json");
    const list = document.getElementById("nav-juegos-list");
    if (!list) return;

    data.juegos.forEach(j => {
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
  } catch(e) {
    console.error("Error cargando juegos en navbar:", e);
  }
}

function setYear() {
  const el = document.getElementById("footer-year");
  if (el) el.textContent = new Date().getFullYear();
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadComponent("navbar-container", "components/navbar.html");
  await loadComponent("footer-container", "components/footer.html");
  await loadNavJuegos();
  setYear();
});