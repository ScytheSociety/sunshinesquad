const API = "https://sunshinesquad.es/api";

const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

function defaultAvatar(id) {
  try { return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(id) % 6n)}.png`; }
  catch { return "https://cdn.discordapp.com/embed/avatars/0.png"; }
}

/* ── Background ─────────────────────────────────────── */
function initBackground() {
  const hour  = new Date().getHours();
  const isDay = hour >= 6 && hour < 20;

  document.getElementById("race-bg").className = isDay ? "day" : "night";

  if (isDay) {
    document.getElementById("sky-obj").innerHTML = '<div class="sun"></div>';
    // Clouds: [width, height, top%, delay_s, duration_s]
    const cfgs = [
      [140, 44, 9,  0,   34],
      [ 95, 32, 26,-13,  25],
      [165, 54, 5, -22,  42],
      [ 72, 27, 40, -7,  29],
      [115, 38, 18,-32,  37],
      [ 88, 30, 32,-16,  23],
    ];
    document.getElementById("sky-layer").innerHTML = cfgs.map(([w, h, top, delay, dur]) =>
      `<div class="cloud" style="width:${w}px;height:${h}px;top:${top}%;` +
      `animation-duration:${dur}s;animation-delay:${delay}s;"></div>`
    ).join("");
  } else {
    document.getElementById("sky-obj").innerHTML = '<div class="moon"></div>';
    // Stars — seeded for consistent layout
    let s = 42, html = "";
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < 100; i++) {
      const x = rng() * 100, y = rng() * 68, sz = rng() * 2 + 1;
      const delay = rng() * 5, dur = 2 + rng() * 3;
      html += `<div class="star" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;` +
              `width:${sz.toFixed(1)}px;height:${sz.toFixed(1)}px;` +
              `animation-duration:${dur.toFixed(1)}s;animation-delay:-${delay.toFixed(1)}s;"></div>`;
    }
    document.getElementById("sky-layer").innerHTML = html;
  }
}

/* ── Runners ─────────────────────────────────────────── */
function renderRunners(runners) {
  const container = document.getElementById("runners-container");
  if (!runners.length) {
    container.innerHTML =
      `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);` +
      `color:rgba(255,255,255,.4);font-size:.85rem;">No hay cumpleaños próximos</div>`;
    return;
  }

  const TRACK_H  = 200;
  const RUNNER_H = 66; // avatar 42 + name + days ≈ 66px
  const count    = runners.length;

  // Usable vertical range: leave margin top/bottom
  const topMin = 4;
  const topMax = TRACK_H - RUNNER_H - 4;
  const step   = count > 1 ? (topMax - topMin) / (count - 1) : 0;

  container.innerHTML = runners.map((r, i) => {
    const src     = r.avatar_url || defaultAvatar(r.discord_user_id);
    // Horizontal: distribute evenly across full track width by index.
    // Runner 0 (soonest) = rightmost, runner N-1 (furthest) = leftmost.
    const leftPct = count === 1
      ? 47
      : 5 + ((count - 1 - i) / (count - 1)) * 86;
    // Vertical: spread evenly, sorted index
    const topPx   = topMin + i * step;
    // Stagger bounce per runner
    const dur      = (0.38 + (i % 5) * 0.06).toFixed(2);
    const delay    = -(i * 0.09).toFixed(2);
    const isToday  = r.es_hoy;
    const [mm, dd] = r.mmdd.split("-");
    const dateStr  = `${parseInt(dd)} de ${MONTHS[parseInt(mm) - 1]}`;
    const daysLbl  = isToday ? "🎂 ¡Hoy!" : `${r.dias_faltantes}d`;

    return `<div class="runner"
      style="left:${leftPct}%;top:${topPx.toFixed(0)}px;animation-duration:${dur}s;animation-delay:${delay}s;"
      title="${r.username} · ${dateStr}${isToday ? " 🎂" : ""}">
      <img class="runner-avatar${isToday ? " is-today" : ""}"
           src="${src}" alt="${r.username}" width="42" height="42"
           onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
      <div class="runner-name">${r.username}</div>
      <div class="runner-days">${daysLbl}</div>
    </div>`;
  }).join("");

  // Confetti for today's birthdays
  if (runners.some(r => r.es_hoy)) spawnConfetti(container);
}

function spawnConfetti(parent) {
  const colors = ["#fbbf24","#f472b6","#60a5fa","#34d399","#a78bfa","#fb923c"];
  for (let i = 0; i < 18; i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    el.style.cssText =
      `left:${5 + Math.random() * 90}%;top:${Math.random() * 70}%;` +
      `background:${colors[i % colors.length]};` +
      `animation-delay:${(Math.random() * 2).toFixed(1)}s;` +
      `animation-duration:${(1.4 + Math.random() * 1.4).toFixed(1)}s;`;
    parent.appendChild(el);
  }
}

/* ── Celebrados ──────────────────────────────────────── */
function renderCelebrados(past) {
  if (!past.length) return;
  document.getElementById("celebrados").style.display = "";
  document.getElementById("celebrados-list").innerHTML = past.map(b => {
    const src  = b.avatar_url || defaultAvatar(b.discord_user_id);
    const [mm, dd] = b.mmdd.split("-");
    const short = `${parseInt(dd)} ${MONTHS[parseInt(mm) - 1].substring(0, 3)}`;
    const full  = `${parseInt(dd)} de ${MONTHS[parseInt(mm) - 1]}`;
    return `<div class="celebrado-item" title="${b.username} · ${full}">
      <img src="${src}" alt="${b.username}" width="38" height="38"
           onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
      <div class="celebrado-name">${b.username}</div>
      <div class="celebrado-date">${short}</div>
    </div>`;
  }).join("");
}

/* ── Main ────────────────────────────────────────────── */
async function init() {
  initBackground();
  document.getElementById("year-label").textContent = String(new Date().getFullYear());

  // Music
  try {
    const res = await fetch(`${API}/config`);
    if (res.ok) {
      const cfg = await res.json();
      const musicUrl = (cfg.birthday_music_url || "").trim();
      if (musicUrl) {
        const audio = document.getElementById("bg-audio");
        const btn   = document.getElementById("music-btn");
        audio.src   = musicUrl;
        btn.style.display = "flex";
        btn.addEventListener("click", () => {
          if (audio.paused) {
            audio.play().catch(() => {});
            btn.textContent = "🔇";
            btn.title = "Pausar música";
          } else {
            audio.pause();
            btn.textContent = "🎵";
            btn.title = "Reproducir música";
          }
        });
      }
    }
  } catch {}

  // Birthdays
  let data = [];
  try {
    const res = await fetch(`${API}/birthdays/all`);
    if (!res.ok) throw new Error();
    data = await res.json();
  } catch {
    document.getElementById("race-loading").textContent = "Error al cargar los datos.";
    return;
  }

  document.getElementById("race-loading").style.display = "none";
  if (!data.length) return;

  // Today's MM-DD for "past this year" detection
  const today   = new Date();
  const todayMD = String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

  // API already sorted by dias_faltantes ASC
  const runners    = data.slice(0, 15);
  const runnerIds  = new Set(runners.map(r => String(r.discord_user_id)));
  // Past = birthday already happened in current calendar year, not among runners
  const past = data.filter(b => !runnerIds.has(String(b.discord_user_id)) && b.mmdd < todayMD);

  renderRunners(runners);
  renderCelebrados(past);
}

document.addEventListener("DOMContentLoaded", init);
