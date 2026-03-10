// Template genérico para páginas de juego
// Lee el atributo data-game del <body> para cargar data/{game}.json
import { loadJson, repoRoot } from "../app.js";

const GAME_KEY = document.body.dataset.game;
const ROOT     = repoRoot();
const API      = "https://sunshinesquad.es/api";

// ── Tabs ───────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
      btn.classList.add("active");
      const tab = document.getElementById("tab-" + btn.dataset.tab);
      if (tab) tab.style.display = "block";
    });
  });
}

// ── Info tabla servidor ────────────────────────────────────────────
function renderTabla(info) {
  const el = document.getElementById("servidor-tabla");
  if (!el || !info?.length) return;
  el.innerHTML = info.map(r => `
    <div class="ro-tabla-row">
      <span class="ro-tabla-label">${r.label}</span>
      <span class="ro-tabla-valor">${r.valor}</span>
    </div>`).join("");
}

// ── Galería ────────────────────────────────────────────────────────
function initGaleria(items, prefix = "galeria") {
  const strip = document.getElementById(`${prefix}-strip`);
  const dots  = document.getElementById(`${prefix}-dots`);
  if (!strip || !items?.length) return;

  items.forEach((item, i) => {
    const slide = document.createElement("div");
    slide.className = "galeria-slide";
    slide.innerHTML = `<img src="${item.imagen}" alt="${item.titulo || ""}" loading="lazy" style="width:100%;height:220px;object-fit:cover;border-radius:10px;">`;
    if (item.titulo) {
      const lbl = document.createElement("div");
      lbl.style.cssText = "font-size:.78rem;color:rgba(255,255,255,.45);margin-top:.4rem;text-align:center;";
      lbl.textContent = item.titulo;
      slide.appendChild(lbl);
    }
    strip.appendChild(slide);

    if (dots) {
      const dot = document.createElement("button");
      dot.className = "galeria-dot" + (i === 0 ? " active" : "");
      dot.onclick = () => scrollTo(strip, dots, i);
      dots.appendChild(dot);
    }
  });

  document.getElementById(`${prefix}-prev`)?.addEventListener("click", () => scrollStep(strip, dots, -1));
  document.getElementById(`${prefix}-next`)?.addEventListener("click", () => scrollStep(strip, dots,  1));
}

function getVisibleIdx(strip) {
  const w = strip.parentElement.offsetWidth;
  return Math.round(strip.scrollLeft / w);
}
function scrollTo(strip, dots, idx) {
  strip.scrollTo({ left: idx * strip.parentElement.offsetWidth, behavior: "smooth" });
  dots?.querySelectorAll(".galeria-dot").forEach((d, i) => d.classList.toggle("active", i === idx));
}
function scrollStep(strip, dots, dir) {
  const total = strip.children.length;
  const cur   = getVisibleIdx(strip);
  scrollTo(strip, dots, Math.max(0, Math.min(total - 1, cur + dir)));
}

// ── Videos ────────────────────────────────────────────────────────
function initVideos(items) {
  const strip = document.getElementById("videos-strip");
  const dots  = document.getElementById("videos-dots");
  if (!strip || !items?.length) return;

  items.forEach((v, i) => {
    const ytId = v.url.match(/(?:v=|youtu\.be\/)([^&?]+)/)?.[1];
    const slide = document.createElement("div");
    slide.className = "videos-slide";
    slide.innerHTML = ytId
      ? `<div style="position:relative;aspect-ratio:16/9;border-radius:10px;overflow:hidden;cursor:pointer;" onclick="this.innerHTML='<iframe src=\\'https://www.youtube.com/embed/${ytId}?autoplay=1\\' style=\\'width:100%;height:100%;border:0;\\' allowfullscreen></iframe>'">
           <img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover;" alt="${v.titulo}">
           <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);">
             <div style="width:52px;height:52px;background:rgba(255,0,0,.85);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">▶</div>
           </div>
         </div>
         <div style="font-size:.8rem;color:rgba(255,255,255,.5);margin-top:.4rem;text-align:center;">${v.titulo}</div>`
      : `<div style="padding:1rem;color:rgba(255,255,255,.4);font-size:.85rem;">${v.titulo}</div>`;
    strip.appendChild(slide);

    if (dots) {
      const dot = document.createElement("button");
      dot.className = "galeria-dot" + (i === 0 ? " active" : "");
      dot.onclick = () => scrollTo(strip, dots, i);
      dots.appendChild(dot);
    }
  });

  document.getElementById("videos-prev")?.addEventListener("click", () => scrollStep(strip, dots, -1));
  document.getElementById("videos-next")?.addEventListener("click", () => scrollStep(strip, dots,  1));
}

// ── Grid de guías / builds ─────────────────────────────────────────
function renderGrid(items, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items?.length) {
    el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;padding:1rem 0;">Próximamente.</div>`;
    return;
  }
  el.innerHTML = items.map(item => `
    <a href="${ROOT}${item.url}" class="ro-card" style="text-decoration:none;">
      <img src="${ROOT}${item.imagen}" alt="${item.nombre}" class="ro-card-img" onerror="this.style.display='none'">
      <div class="ro-card-body">
        <div class="ro-card-title">${item.nombre}</div>
        <div class="ro-card-desc">${item.descripcion || ""}</div>
      </div>
    </a>`).join("");
}

// ── Clan desde API ─────────────────────────────────────────────────
async function renderClan(juegoNombre) {
  const el = document.getElementById("clan-content");
  if (!el) return;
  try {
    const res   = await fetch(`${API}/ranking?limit=10`);
    const items = await res.json();
    // Filtrar por juego
    const miembros = items.filter(u => u.juegos?.some(j => j.game?.toLowerCase().includes(juegoNombre.toLowerCase())));
    if (!miembros.length) {
      el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;">Sin datos de miembros aún.</div>`;
      return;
    }
    el.innerHTML = miembros.map((u, i) => {
      const pts = u.juegos.find(j => j.game?.toLowerCase().includes(juegoNombre.toLowerCase()))?.points || 0;
      return `
        <div class="d-flex align-items-center gap-2 mb-2 p-2" style="border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);">
          ${u.avatar_url ? `<img src="${u.avatar_url}" width="32" height="32" style="border-radius:50%;object-fit:cover;" alt="${u.username}">` : `<div style="width:32px;height:32px;border-radius:50%;background:rgba(99,102,241,.2);"></div>`}
          <div style="flex:1;">
            <div style="font-size:.88rem;font-weight:600;color:#fff;">${u.username}</div>
            ${u.juegos.find(j=>j.game?.toLowerCase().includes(juegoNombre.toLowerCase()))?.rank_name
              ? `<div style="font-size:.72rem;color:rgba(255,255,255,.4);">${u.juegos.find(j=>j.game?.toLowerCase().includes(juegoNombre.toLowerCase())).rank_name}</div>` : ""}
          </div>
          <div style="font-size:.85rem;font-weight:700;color:#fbbf24;">${pts.toLocaleString()} pts</div>
        </div>`;
    }).join("");
  } catch {
    el.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:.82rem;">Clan no disponible.</div>`;
  }
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!GAME_KEY) return;
  initTabs();

  try {
    const data = await loadJson(`data/${GAME_KEY}.json`);

    // Descripción
    const descEl = document.getElementById("game-descripcion");
    if (descEl) descEl.textContent = data.descripcion || "";

    // Servidor
    const srv = data.servidor;
    if (srv) {
      const logoEl = document.getElementById("servidor-logo");
      if (logoEl && srv.logo) { logoEl.src = srv.logo; logoEl.style.display = ""; }
      else if (logoEl) logoEl.style.display = "none";

      const descSrv = document.getElementById("servidor-descripcion");
      if (descSrv) descSrv.textContent = srv.descripcion || "";

      const btnDesc = document.getElementById("btn-descarga");
      if (btnDesc && srv.descarga) { btnDesc.href = srv.descarga; btnDesc.style.display = "inline-flex"; }

      const btnDisc = document.getElementById("btn-discord");
      if (btnDisc) { if (srv.discord) { btnDisc.href = srv.discord; btnDisc.style.display = "inline-flex"; } else btnDisc.style.display = "none"; }

      const btnWeb = document.getElementById("btn-web");
      if (btnWeb) { if (srv.web) { btnWeb.href = srv.web; btnWeb.style.display = "inline-flex"; } else btnWeb.style.display = "none"; }

      const btnWiki = document.getElementById("btn-wiki");
      if (btnWiki) { if (srv.wiki) { btnWiki.href = srv.wiki; btnWiki.style.display = "inline-flex"; } else btnWiki.style.display = "none"; }

      renderTabla(srv.info);
    }

    initGaleria(data.galeria);
    initVideos(data.videos);
    renderGrid(data.guias,  "guias-grid");
    renderGrid(data.builds, "builds-grid");
    renderClan(data.juego_nombre || GAME_KEY);

  } catch(e) {
    console.error("game.js:", e);
  }
});
