import { loadJson, repoRoot } from "../app.js";

// ── Twitch embeds ──────────────────────────────────────────
function buildPlayer(channel) {
  const parent = window.location.hostname;
  return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&autoplay=true&muted=false`;
}

function buildChat(channel) {
  const parent = window.location.hostname;
  return `https://www.twitch.tv/embed/${channel}/chat?parent=${parent}`;
}

function setStream(channel) {
  document.getElementById("stream-iframe").src = buildPlayer(channel);
  document.getElementById("chat-iframe").src    = buildChat(channel);
}

// ── Iguala altura chat con player ─────────────────────────
function matchChatHeight() {
  const player    = document.getElementById("player-wrap");
  const chatWrap  = document.getElementById("chat-wrap");
  const chatFrame = document.getElementById("chat-iframe");
  if (!player || !chatWrap || !chatFrame) return;
  const h = player.offsetWidth * 9 / 16;
  chatWrap.style.height  = h + "px";
  chatFrame.style.height = h + "px";
}

window.addEventListener("load",   matchChatHeight);
window.addEventListener("resize", matchChatHeight);

// ── Canales ────────────────────────────────────────────────
function renderChannels(channels) {
  const list = document.getElementById("channel-list");
  if (!list) return;
  channels.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.className = "btn-ss";
    btn.textContent = item.name;
    btn.addEventListener("click", () => {
      list.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      setStream(item.channel);
    });
    list.appendChild(btn);
    if (idx === 0) { btn.classList.add("active"); setStream(item.channel); }
  });
}

// ── Utilidad: convierte fecha Lima → local ─────────────────
function toLocalDate(fechaISO, horaStr) {
  const isoStr = `${fechaISO}T${horaStr}:00`;
  const enLima = new Date(new Date(isoStr).toLocaleString("en-US", { timeZone: "America/Lima" }));
  const diffMs = new Date(isoStr) - enLima;
  return new Date(new Date(isoStr).getTime() + diffMs);
}

function getEstado(inicio, duracionH) {
  const ahora = new Date();
  const fin   = new Date(inicio.getTime() + duracionH * 3600000 + 3600000);
  if (ahora < inicio) return "futuro";
  if (ahora < fin)    return "activo";
  return "pasado";
}

// ── Eventos activos/próximos para index ───────────────────
function renderEventosIndex(eventos) {
  const wrap = document.getElementById("eventos-activos");
  if (!wrap) return;

  const ahora  = new Date();
  const manana = new Date(ahora);
  manana.setDate(ahora.getDate() + 2);

  const relevantes = eventos
    .map(ev => ({ ...ev, inicio: toLocalDate(ev.fecha, ev.hora) }))
    .map(ev => ({ ...ev, estado: getEstado(ev.inicio, ev.duracion) }))
    .filter(ev => ev.estado === "activo" || (ev.estado === "futuro" && ev.inicio < manana))
    .sort((a, b) => a.inicio - b.inicio)
    .slice(0, 5);

  if (relevantes.length === 0) {
    wrap.style.display = "none";
    return;
  }

  wrap.style.display = "block";

  const strip = document.getElementById("eventos-strip");
  if (!strip) return;

  relevantes.forEach(ev => {
    const horaStr  = ev.inicio.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12: true });
    const fechaStr = ev.inicio.toLocaleDateString("es", { weekday:"short", day:"numeric", month:"short" });

    const estadoColor = {
      activo: { bg: "rgba(34,197,94,.18)", border: "rgba(34,197,94,.4)", text: "#bbf7d0", label: "🟢 En curso" },
      futuro: { bg: "rgba(99,102,241,.18)", border: "rgba(99,102,241,.4)", text: "#c7d2fe", label: "🔵 Próximo" }
    };
    const c = estadoColor[ev.estado] || estadoColor.futuro;

    const card = document.createElement("div");
    card.style.cssText = `
      flex-shrink:0;
      background:${c.bg};
      border:1px solid ${c.border};
      border-radius:12px;
      padding:.75rem 1rem;
      min-width:180px;
      max-width:220px;
    `;
    card.innerHTML = `
      <div style="font-size:.65rem;font-weight:700;color:${c.text};margin-bottom:.3rem;">${c.label}</div>
      <div style="font-weight:700;font-size:.85rem;color:#fff;line-height:1.2;margin-bottom:.2rem;">${ev.juego}</div>
      <div style="font-size:.78rem;color:rgba(255,255,255,.55);margin-bottom:.3rem;">${ev.evento}</div>
      <div style="font-size:.72rem;color:rgba(255,255,255,.35);">${fechaStr} · ${horaStr}</div>
    `;
    strip.appendChild(card);
  });
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const streams = await loadJson("data/streams.json");
    renderChannels(streams.channels);
    setTimeout(matchChatHeight, 100);
  } catch(e) { console.error("streams.json:", e); }

  try {
    const sched = await loadJson("data/schedule.json");
    renderEventosIndex(sched.eventos);
  } catch(e) { console.error("schedule.json en index:", e); }
});