import { loadJson, rootPrefix } from "../app.js";

function withRoot(pathFromRoot) {
  return rootPrefix() + pathFromRoot.replace(/^\//, "");
}

function buildEmbed(item) {
  const parent = window.location.hostname;
  const channel = encodeURIComponent(item.channel);
  return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&autoplay=true&muted=true`;
}

function buildChat(item) {
  const parent = window.location.hostname;
  const channel = encodeURIComponent(item.channel);
  return `https://www.twitch.tv/embed/${channel}/chat?parent=${parent}`;
}

function setFrame(item) {
  const frame = document.getElementById("stream-iframe");
  if (frame) frame.src = buildEmbed(item);
}

function setChat(item) {
  const chatFrame = document.getElementById("chat-iframe");
  if (chatFrame) chatFrame.src = buildChat(item);
}

function renderStreams(data) {
  const tabs = document.getElementById("stream-tabs");
  const list = document.getElementById("stream-list");
  if (!tabs || !list) return;

  // Solo Twitch (pero dejamos la estructura por si luego quieres más cosas)
  let currentPlatform = data.default || data.channels?.[0]?.id || "twitch";

  tabs.innerHTML = "";
  data.channels.forEach(ch => {
    const btn = document.createElement("button");
    btn.className = "btn btn-sm btn-outline-light me-2 mb-2";
    btn.textContent = ch.label;
    btn.dataset.platform = ch.id;
    btn.onclick = () => { currentPlatform = ch.id; renderList(); markTabs(); };
    tabs.appendChild(btn);
  });

  function markTabs() {
    [...tabs.querySelectorAll("button")].forEach(b =>
      b.classList.toggle("active", b.dataset.platform === currentPlatform)
    );
  }

  function renderList() {
    list.innerHTML = "";
    const platform = data.channels.find(c => c.id === currentPlatform) || data.channels[0];

    platform.items.forEach((item, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "list-group-item list-group-item-action d-flex justify-content-between align-items-center";
      b.innerHTML = `<span>${item.name}</span><span class="badge text-bg-secondary">${platform.label}</span>`;
      b.onclick = () => {
        [...list.querySelectorAll(".list-group-item")].forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        setFrame(item);
        setChat(item);
      };
      list.appendChild(b);

      // primer canal por defecto
      if (idx === 0) {
        b.classList.add("active");
        setFrame(item);
        setChat(item);
      }
    });
  }

  renderList();
  markTabs();
}

function renderGames(data) {
  const strip = document.getElementById("games-strip");
  const title = document.getElementById("games-title");
  if (title) title.textContent = data.title || "Juegos";
  if (!strip) return;

  strip.innerHTML = "";
  data.items.forEach(g => {
    const a = document.createElement("a");
    a.className = "text-reset";
    a.href = withRoot(g.url);
    a.innerHTML = `
      <div class="game-card">
        <img class="game-cover" src="${withRoot(g.image)}" alt="${g.name}">
        <div class="p-3">
          <div class="game-name">${g.name}</div>
          <div class="text-secondary small">Ver sección</div>
        </div>
      </div>
    `;
    strip.appendChild(a);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const streams = await loadJson("data/streams.json");
  renderStreams(streams);

  document.addEventListener("DOMContentLoaded", async () => {
    const streams = await loadJson("data/streams.json");
    renderStreams(streams);

    const games = await loadJson("data/games.json");
    renderGames(games);
  });

});
