const API = "https://sunshinesquad.es/api";

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

function defaultAvatar(id) {
  try { return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(id) % 6n)}.png`; }
  catch { return "https://cdn.discordapp.com/embed/avatars/0.png"; }
}

function buildCard(b, isToday, isNext) {
  const src  = b.avatar || defaultAvatar(b.discord_user_id);
  const [mm, dd] = b.mmdd.split("-").map(Number);
  const dateStr  = `${String(dd).padStart(2,"0")} ${MONTH_NAMES[mm - 1]}`;

  let ringClass  = isToday ? "bday-avatar-ring-today" : isNext ? "bday-avatar-ring-soon" : "bday-avatar-ring";
  let cardExtra  = isToday ? " bday-today-card" : "";
  let borderColor = isToday ? "rgba(250,204,21,.3)" : isNext ? "rgba(165,180,252,.2)" : "rgba(255,255,255,.08)";

  let badge = "";
  if (isToday) badge = `<div class="bday-badge bday-badge-today">🎂 Hoy</div>`;
  else if (isNext) badge = `<div class="bday-badge bday-badge-next">⭐ Próximo</div>`;

  let daysEl = "";
  if (isToday) {
    daysEl = `<div style="font-size:.72rem;font-weight:800;color:#fde047;">🎉 ¡Feliz cumpleaños!</div>`;
  } else if (b.dias_faltantes <= 7) {
    daysEl = `<div style="font-size:.72rem;color:#a5b4fc;">en ${b.dias_faltantes} día${b.dias_faltantes === 1 ? "" : "s"}</div>`;
  } else {
    daysEl = `<div style="font-size:.72rem;color:rgba(255,255,255,.3);">${dateStr}</div>`;
  }

  return `
    <a href="../../pages/perfil/perfil.html?id=${b.discord_user_id}"
       class="bday-card${cardExtra}" style="border-color:${borderColor};">
      ${badge}
      <img src="${src}" alt="${b.username}" width="56" height="56"
           class="${ringClass}" style="border-radius:50%;object-fit:cover;flex-shrink:0;"
           onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'" loading="lazy">
      <div style="font-size:.85rem;font-weight:700;color:#fff;text-align:center;
                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">
        ${b.username}
      </div>
      ${daysEl}
    </a>
  `;
}

async function load() {
  const listEl   = document.getElementById("birthday-list");
  const bannerEl = document.getElementById("birthday-banner");
  const namesEl  = document.getElementById("birthday-banner-names");

  let data = [];
  try {
    const res = await fetch(`${API}/birthdays/all`);
    if (!res.ok) throw new Error();
    data = await res.json();
  } catch {
    listEl.innerHTML = `<div class="text-center py-4" style="color:rgba(255,255,255,.3);">Error al cargar cumpleaños.</div>`;
    return;
  }

  if (!data.length) {
    listEl.innerHTML = `<div class="text-center py-4" style="color:rgba(255,255,255,.3);">No hay cumpleaños registrados.</div>`;
    return;
  }

  // Banner for today's birthdays
  const hoy = data.filter(b => b.es_hoy);
  if (hoy.length) {
    bannerEl.style.display = "";
    namesEl.textContent = hoy.map(b => b.username).join(", ");
  }

  // Identify the next upcoming (first with dias_faltantes > 0)
  const nextPerson = data.find(b => !b.es_hoy && b.dias_faltantes > 0);

  // Group by month
  const groups = {};
  data.forEach(b => {
    const mm = parseInt(b.mmdd.split("-")[0]) - 1;
    if (!groups[mm]) groups[mm] = [];
    groups[mm].push(b);
  });

  let html = "";
  Object.keys(groups).sort((a, b) => {
    // Sort months by proximity (already sorted by API via dias_faltantes)
    const firstA = groups[a][0].dias_faltantes;
    const firstB = groups[b][0].dias_faltantes;
    return firstA - firstB;
  }).forEach(monthIdx => {
    const monthBdays = groups[monthIdx];
    html += `
      <div class="mb-4">
        <div style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.5px;
                    color:rgba(255,255,255,.3);padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.06);
                    margin-bottom:.75rem;">
          ${MONTH_NAMES[monthIdx]}
        </div>
        <div class="bday-grid">
          ${monthBdays.map(b => buildCard(b, b.es_hoy, b === nextPerson)).join("")}
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;
}

load();
