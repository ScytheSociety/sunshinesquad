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

// ── Iguala la altura del chat a la del player ──────────────
function matchChatHeight() {
  const player   = document.getElementById("player-wrap");
  const chatWrap = document.getElementById("chat-wrap");
  const chatFrame = document.getElementById("chat-iframe");
  if (!player || !chatWrap || !chatFrame) return;

  // El player usa aspect-ratio:16/9 así que su altura real es width * 9/16
  const h = player.offsetWidth * 9 / 16;
  chatWrap.style.height  = h + "px";
  chatFrame.style.height = h + "px";
}

window.addEventListener("load",   matchChatHeight);
window.addEventListener("resize", matchChatHeight);

// ── Renderiza lista de canales ─────────────────────────────
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

    if (idx === 0) {
      btn.classList.add("active");
      setStream(item.channel);
    }
  });
}

// ── Renderiza carrusel de juegos ───────────────────────────
function renderGames(data) {
  const strip = document.getElementById("games-strip");
  const title = document.getElementById("games-title");
  if (title) title.textContent = data.title || "Juegos";
  if (!strip) return;

  data.items.forEach(g => {
    const a = document.createElement("a");
    a.href = repoRoot() + g.url;
    a.style.cssText = "text-decoration:none;color:inherit;scroll-snap-align:start;";
    a.innerHTML = `
      <div style="border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.03);width:180px;flex-shrink:0;">
        <img src="${repoRoot() + g.image}" alt="${g.name}"
             style="width:100%;aspect-ratio:4/5;object-fit:cover;display:block;">
        <div style="padding:.75rem 1rem;">
          <div style="font-weight:600;font-size:.9rem;">${g.name}</div>
          <div style="color:rgba(255,255,255,.4);font-size:.78rem;">Ver sección</div>
        </div>
      </div>
    `;
    strip.appendChild(a);
  });
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const streams = await loadJson("data/streams.json");
    renderChannels(streams.channels);
    // Recalcular altura tras renderizar (el player ya tiene tamaño)
    setTimeout(matchChatHeight, 100);
  } catch(e) {
    console.error("streams.json:", e);
  }

  try {
    const games = await loadJson("data/games.json");
    renderGames(games);
  } catch(e) {
    console.error("games.json:", e);
  }
});