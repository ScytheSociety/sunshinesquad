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

    const ratesBase = document.getElementById("rates-base");
    const ratesFinde = document.getElementById("rates-finde");
    if (ratesBase) ratesBase.textContent = s.rates.base;
    if (ratesFinde) ratesFinde.textContent = s.rates.finde;

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

// ── Galería ────────────────────────────────────────────────
function renderGaleria(items) {
    const strip = document.getElementById("galeria-strip");
    if (!strip) return;
    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "galeria-item";
        div.innerHTML = `
      <img src="${repoRoot() + item.imagen}" alt="${item.titulo}">
      <div class="galeria-item-titulo">${item.titulo}</div>
    `;
        strip.appendChild(div);
    });
}

// ── Cards de guías o builds ────────────────────────────────
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
        renderCards(data.guias, "guias-grid");
        renderCards(data.builds, "builds-grid");
    } catch (e) {
        console.error("ragnarok.json:", e);
    }
});