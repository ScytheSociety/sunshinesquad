async function loadJson(path){
  const res = await fetch(path, { cache: "no-store" });
  if(!res.ok) throw new Error(`No se pudo cargar ${path} (${res.status})`);
  return await res.json();
}

function buildEmbed(item){
  const parent = window.location.hostname;
  const channel = encodeURIComponent(item.channel);
  return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&autoplay=true&muted=true`;
}

function buildChat(item){
  const parent = window.location.hostname;
  const channel = encodeURIComponent(item.channel);
  return `https://www.twitch.tv/embed/${channel}/chat?parent=${parent}`;
}

function setFrame(item){
  const frame = document.getElementById("stream-iframe");
  if(frame) frame.src = buildEmbed(item);
}

function setChat(item){
  const chatFrame = document.getElementById("chat-iframe");
  if(chatFrame) chatFrame.src = buildChat(item);
}

function renderStreams(data){
  const tabs = document.getElementById("stream-tabs");
  const list = document.getElementById("stream-list");
  if(!tabs || !list) return;

  tabs.innerHTML = "";
  list.innerHTML = "";

  const platform = data.channels?.[0];
  if(!platform || !platform.items?.length) return;

  // Botón único "Twitch" (porque solo hay Twitch)
  const btn = document.createElement("button");
  btn.className = "btn btn-sm btn-outline-light me-2 mb-2 active";
  btn.textContent = "Twitch";
  tabs.appendChild(btn);

  platform.items.forEach((item, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "list-group-item list-group-item-action d-flex justify-content-between align-items-center";
    b.innerHTML = `<span>${item.name}</span><span class="badge text-bg-secondary">Twitch</span>`;
    b.onclick = () => {
      [...list.querySelectorAll(".list-group-item")].forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      setFrame(item);
      setChat(item);
    };
    list.appendChild(b);

    if(idx === 0){
      b.classList.add("active");
      setFrame(item);
      setChat(item);
    }
  });
}

function renderGames(data){
  const strip = document.getElementById("games-strip");
  const title = document.getElementById("games-title");
  if(title) title.textContent = data.title || "Juegos";
  if(!strip) return;

  strip.innerHTML = "";
  (data.items || []).forEach(g => {
    const a = document.createElement("a");
    a.className = "text-reset";
    a.href = g.url;
    a.innerHTML = `
      <div class="game-card">
        <img class="game-cover" src="${g.image}" alt="${g.name}">
        <div class="p-3">
          <div class="game-name">${g.name}</div>
          <div class="text-secondary small">Ver sección</div>
        </div>
      </div>
    `;
    strip.appendChild(a);
  });
}

// Si algo falla, lo mostramos en pantalla (sin consola)
function showError(msg){
  const host = document.createElement("div");
  host.className = "container mt-3";
  host.innerHTML = `<div class="alert alert-danger mb-0">${msg}</div>`;
  document.body.prepend(host);
}

document.addEventListener("DOMContentLoaded", async () => {
  try{
    const streams = await loadJson("./data/streams.json");
    renderStreams(streams);
  }catch(e){
    showError("Error cargando streams.json: " + e.message);
  }

  try{
    const games = await loadJson("./data/games.json");
    renderGames(games);
  }catch(e){
    showError("Error cargando games.json: " + e.message);
  }
});
