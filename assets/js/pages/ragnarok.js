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

    const btnWeb = document.getElementById("btn-web");
    const btnWiki = document.getElementById("btn-wiki");
    const btnDesc = document.getElementById("btn-descarga");
    const btnDiscord = document.getElementById("btn-discord");

    if (btnWeb) btnWeb.href = s.web;
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

// ── Slider genérico (sliding window) ──────────────────────
// Siempre se ven `visible` items. Al avanzar se desplaza de 1 en 1.
function buildSlider({ stripId, dotsId, prevId, nextId, visible, gap, dotClass }) {
    const strip = document.getElementById(stripId);
    const dotsEl = document.getElementById(dotsId);
    const btnPrev = document.getElementById(prevId);
    const btnNext = document.getElementById(nextId);
    if (!strip) return null;

    let current = 0;

    function totalItems() { return strip.children.length; }
    function maxPos() { return Math.max(0, totalItems() - visible); }

    function setWidths() {
        const containerW = strip.parentElement.offsetWidth;
        const totalGap = gap * (visible - 1);
        const w = (containerW - totalGap) / visible;
        [...strip.children].forEach(el => { el.style.width = w + "px"; });
        return w;
    }

    function updateDots() {
        if (!dotsEl) return;
        [...dotsEl.children].forEach((d, i) => d.classList.toggle("active", i === current));
    }

    function updateBtns() {
        if (btnPrev) btnPrev.disabled = current === 0;
        if (btnNext) btnNext.disabled = current >= maxPos();
    }

    function goTo(idx) {
        current = Math.max(0, Math.min(idx, maxPos()));
        const w = setWidths();
        const offset = current * (w + gap);
        strip.style.transform = `translateX(-${offset}px)`;
        updateDots();
        updateBtns();
    }

    if (btnPrev) btnPrev.addEventListener("click", () => goTo(current - 1));
    if (btnNext) btnNext.addEventListener("click", () => goTo(current + 1));
    window.addEventListener("resize", () => goTo(current));

    function addDot(idx) {
        if (!dotsEl) return;
        const dot = document.createElement("div");
        dot.className = dotClass + (idx === 0 ? " active" : "");
        dot.addEventListener("click", () => goTo(idx));
        dotsEl.appendChild(dot);
    }

    function init() {
        setTimeout(() => { setWidths(); goTo(0); }, 60);
    }

    return { goTo, addDot, init };
}

// ── Cuántos items mostrar según ancho de pantalla ──────────
function getVisible(maxVisible) {
    const w = window.innerWidth;
    if (w < 480) return 1;
    if (w < 768) return 2;
    if (w < 1024) return Math.min(3, maxVisible);
    return maxVisible;
}

// ── Galería de imágenes (máx 5 visibles) ──────────────────
function renderGaleria(items) {
    const GAP = 10;

    const strip = document.getElementById("galeria-strip");
    const dotsEl = document.getElementById("galeria-dots");
    const btnPrev = document.getElementById("galeria-prev");
    const btnNext = document.getElementById("galeria-next");
    if (!strip) return;

    let current = 0;

    items.forEach((item, idx) => {
        const div = document.createElement("div");
        div.className = "galeria-item";
        div.innerHTML = `
      <img src="${repoRoot() + item.imagen}" alt="${item.titulo}"
           onerror="this.style.minHeight='100px'">
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

    function setWidths() {
        const visible = getVisible(5);
        const containerW = strip.parentElement.offsetWidth;
        const w = (containerW - GAP * (visible - 1)) / visible;
        [...strip.children].forEach(el => { el.style.width = w + "px"; });
        return { w, visible };
    }

    function updateDots() {
        if (!dotsEl) return;
        [...dotsEl.children].forEach((d, i) => d.classList.toggle("active", i === current));
    }

    function goTo(idx) {
        const { w, visible } = setWidths();
        const max = Math.max(0, items.length - visible);
        current = Math.max(0, Math.min(idx, max));
        strip.style.transform = `translateX(-${current * (w + GAP)}px)`;
        updateDots();
        if (btnPrev) btnPrev.disabled = current === 0;
        if (btnNext) btnNext.disabled = current >= max;
    }

    if (btnPrev) btnPrev.addEventListener("click", () => goTo(current - 1));
    if (btnNext) btnNext.addEventListener("click", () => goTo(current + 1));
    window.addEventListener("resize", () => goTo(current));

    setTimeout(() => goTo(0), 60);
}

// ── Galería de videos (máx 3 visibles) ────────────────────
function renderVideos(videos) {
    const GAP = 10;

    const strip = document.getElementById("videos-strip");
    const dotsEl = document.getElementById("videos-dots");
    const btnPrev = document.getElementById("videos-prev");
    const btnNext = document.getElementById("videos-next");
    if (!strip) return;

    let current = 0;

    videos.forEach((v, idx) => {
        const div = document.createElement("div");
        div.className = "video-item";

        let embedUrl = v.url;
        const ytMatch = v.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
        if (ytMatch) embedUrl = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;

        div.innerHTML = `
      <iframe src="${embedUrl}" allowfullscreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
      </iframe>
      <div class="video-titulo">${v.titulo}</div>
    `;
        strip.appendChild(div);

        if (dotsEl) {
            const dot = document.createElement("div");
            dot.className = "videos-dot" + (idx === 0 ? " active" : "");
            dot.addEventListener("click", () => goTo(idx));
            dotsEl.appendChild(dot);
        }
    });

    function setWidths() {
        const visible = getVisible(3);
        const containerW = strip.parentElement.offsetWidth;
        const w = (containerW - GAP * (visible - 1)) / visible;
        [...strip.children].forEach(el => { el.style.width = w + "px"; });
        return { w, visible };
    }

    function updateDots() {
        if (!dotsEl) return;
        [...dotsEl.children].forEach((d, i) => d.classList.toggle("active", i === current));
    }

    function goTo(idx) {
        const { w, visible } = setWidths();
        const max = Math.max(0, videos.length - visible);
        current = Math.max(0, Math.min(idx, max));
        strip.style.transform = `translateX(-${current * (w + GAP)}px)`;
        updateDots();
        if (btnPrev) btnPrev.disabled = current === 0;
        if (btnNext) btnNext.disabled = current >= max;
    }

    if (btnPrev) btnPrev.addEventListener("click", () => goTo(current - 1));
    if (btnNext) btnNext.addEventListener("click", () => goTo(current + 1));
    window.addEventListener("resize", () => goTo(current));

    setTimeout(() => goTo(0), 60);
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
        renderGaleria(data.galeria);
        renderVideos(data.videos);
        renderCards(data.guias, "guias-grid");
        renderCards(data.builds, "builds-grid");
    } catch (e) {
        console.error("ragnarok.json:", e);
    }
});