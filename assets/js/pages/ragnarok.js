import { loadJson, repoRoot } from "../app.js";

// ── Pestañas ───────────────────────────────────────────────
function initTabs() {
  const btns = document.querySelectorAll(".tab-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      btns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).style.display = "block";
    });
  });
}

// ── Servidor ───────────────────────────────────────────────
function renderServidor(s) {
  const logo = document.getElementById("servidor-logo");
  if (logo) logo.src = s.logo;

  const desc = document.getElementById("servidor-descripcion");
  if (desc) desc.textContent = s.descripcion;

  const btnWeb     = document.getElementById("btn-web");
  const btnWiki    = document.getElementById("btn-wiki");
  const btnDesc    = document.getElementById("btn-descarga");
  const btnDiscord = document.getElementById("btn-discord");

  if (btnWeb)  btnWeb.href  = s.web;
  if (btnWiki) btnWiki.href = s.wiki;

  if (btnDesc) {
    if (s.descarga) {
      btnDesc.href = s.descarga;
      btnDesc.style.display = "inline-flex";
    } else {
      btnDesc.style.display = "none";
    }
  }

  if (btnDiscord) {
    if (s.discord) {
      btnDiscord.href = s.discord;
      btnDiscord.style.display = "inline-flex";
    } else {
      btnDiscord.style.display = "none";
    }
  }

  const tabla = document.getElementById("servidor-tabla");
  if (tabla) {
    s.info.forEach(item => {
      const fila = document.createElement("div");
      fila.className = "ro-tabla-fila";
      fila.innerHTML = `
        <span class="ro-tabla-fila-label">${item.label}</span>
        <span class="ro-tabla-fila-valor">${item.valor}</span>
      `;
      tabla.appendChild(fila);
    });
  }
}

// ── Streamers ──────────────────────────────────────────────
function renderStreamers(streamers) {
  const row = document.getElementById("streamers-row");
  if (!row) return;

  streamers.forEach(s => {
    const a = document.createElement("a");
    a.href = s.link;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.className = "streamer-btn";
    a.style.cssText = `
      background: ${s.color}22;
      border-color: ${s.color}88;
      color: ${s.colorTexto === "#000000" ? "#000" : "#fff"};
      --glow: ${s.color};
    `;
    a.innerHTML = `
      <span>${s.icono}</span>
      <span>
        <span style="display:block;line-height:1.2;">${s.nombre}</span>
        <span class="streamer-plataforma">${s.plataforma}</span>
      </span>
    `;
    row.appendChild(a);
  });
}

// ── Galería de imágenes con navegación ────────────────────
function renderGaleria(items) {
  const strip     = document.getElementById("galeria-strip");
  const dotsEl    = document.getElementById("galeria-dots");
  const btnPrev   = document.getElementById("galeria-prev");
  const btnNext   = document.getElementById("galeria-next");
  if (!strip) return;

  let current = 0;
  let itemWidth = 0;
  const visible = () => window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 3;

  items.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "galeria-item";
    div.style.flex = "0 0 calc((100% - " + (visible() - 1) * 12 + "px) / " + visible() + ")";
    div.innerHTML = `
      <img src="${repoRoot() + item.imagen}" alt="${item.titulo}"
           onerror="this.parentElement.style.display='none'">
      <div class="galeria-item-titulo">${item.titulo}</div>
    `;
    strip.appendChild(div);

    if (dotsEl) {
      const dot = document.createElement("div");
      dot.className = "galeria-dot" + (idx === 0 ? " active" : "");
      dot.addEventListener("click", () => goTo(idx));
      dotsEl.appendChild(dot);
    }
  });

  function updateDots() {
    if (!dotsEl) return;
    dotsEl.querySelectorAll(".galeria-dot").forEach((d, i) => {
      d.classList.toggle("active", i === current);
    });
  }

  function goTo(idx) {
    const max = Math.max(0, items.length - visible());
    current = Math.max(0, Math.min(idx, max));
    const w = strip.querySelector(".galeria-item");
    if (!w) return;
    const gap = 12;
    const offset = current * (w.offsetWidth + gap);
    strip.style.transform = `translateX(-${offset}px)`;
    updateDots();
  }

  if (btnPrev) btnPrev.addEventListener("click", () => goTo(current - 1));
  if (btnNext) btnNext.addEventListener("click", () => goTo(current + 1));

  window.addEventListener("resize", () => goTo(current));
}

// ── Galería de videos ──────────────────────────────────────
function renderVideos(videos) {
  const grid = document.getElementById("videos-grid");
  if (!grid) return;

  videos.forEach(v => {
    const div = document.createElement("div");
    div.className = "video-item";

    // Convierte URL de YouTube a embed
    let embedUrl = v.url;
    const ytMatch = v.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
    if (ytMatch) {
      embedUrl = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
    }

    div.innerHTML = `
      <iframe src="${embedUrl}" allowfullscreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
      </iframe>
      <div class="video-titulo">${v.titulo}</div>
    `;
    grid.appendChild(div);
  });
}

// ── Cards guías / builds ───────────────────────────────────
function renderCards(items, containerId) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  items.forEach(item => {
    const a = document.createElement("a");
    a.className = "ro-card";
    a.href = repoRoot() + item.url;
    a.innerHTML = `
      <img src="${repoRoot() + item.imagen}" alt="${item.nombre}">
      <div class="ro-card-body">
        <div class="ro-card-title">${item.nombre}</div>
        <div class="ro-card-desc">${item.descripcion}</div>
      </div>
    `;
    grid.appendChild(a);
  });
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  try {
    const data = await loadJson("data/ragnarok.json");

    const d1 = document.getElementById("ro-descripcion");
    if (d1) d1.textContent = data.descripcion;

    renderServidor(data.servidor);
    renderStreamers(data.streamers);
    renderGaleria(data.galeria);
    renderVideos(data.videos);
    renderCards(data.guias,  "guias-grid");
    renderCards(data.builds, "builds-grid");
  } catch(e) {
    console.error("ragnarok.json:", e);
  }
});