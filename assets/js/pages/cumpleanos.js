const API = "https://sunshinesquad.es/api";

const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

function defaultAvatar(discordId) {
  try { return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(discordId) % 6n)}.png`; }
  catch { return "https://cdn.discordapp.com/embed/avatars/0.png"; }
}

function avatarEl(b, size = 40) {
  const src = b.avatar || defaultAvatar(b.discord_user_id);
  return `<img src="${src}" alt="${b.username}" width="${size}" height="${size}"
               style="border-radius:50%;object-fit:cover;border:2px solid rgba(99,102,241,.3);"
               onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"
               loading="lazy">`;
}

async function load() {
  const listEl  = document.getElementById("birthday-list");
  const todayEl = document.getElementById("birthday-today");
  const todayList = document.getElementById("birthday-today-list");

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

  // Show "today" section
  const hoy = data.filter(b => b.es_hoy);
  if (hoy.length) {
    todayEl.style.display = "";
    todayList.innerHTML = hoy.map(b => `
      <div style="display:flex;align-items:center;gap:.6rem;">
        ${avatarEl(b, 44)}
        <div>
          <div style="font-weight:700;font-size:.9rem;color:#fff;">${b.username}</div>
          <div style="font-size:.72rem;color:#fde047;">🎉 ¡Hoy!</div>
        </div>
      </div>
    `).join("");
  }

  // Group by month
  const groups = {};
  data.forEach(b => {
    const [mm] = b.mmdd.split("-");
    const monthIdx = parseInt(mm) - 1;
    if (!groups[monthIdx]) groups[monthIdx] = [];
    groups[monthIdx].push(b);
  });

  // Build list sorted by dias_faltantes (already sorted by API)
  let html = "";
  let lastMonth = -1;

  data.forEach(b => {
    const [mm, dd] = b.mmdd.split("-").map(Number);
    const monthIdx = mm - 1;

    if (monthIdx !== lastMonth) {
      if (lastMonth !== -1) html += "</div></div>"; // close previous month
      html += `
        <div class="mb-3">
          <div style="font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.5px;
                      color:rgba(255,255,255,.3);padding:.35rem 0;border-bottom:1px solid rgba(255,255,255,.06);
                      margin-bottom:.6rem;">
            ${MONTH_NAMES[monthIdx]}
          </div>
          <div class="d-flex flex-column gap-2">
      `;
      lastMonth = monthIdx;
    }

    const isSoon = b.dias_faltantes <= 7 && !b.es_hoy;
    const isToday = b.es_hoy;
    const dayLabel = isToday
      ? "<span style='color:#fde047;font-weight:800;'>🎉 Hoy</span>"
      : isSoon
        ? `<span style='color:#a5b4fc;'>en ${b.dias_faltantes} día${b.dias_faltantes === 1 ? "" : "s"}</span>`
        : `<span style='color:rgba(255,255,255,.25);'>${String(dd).padStart(2,"0")}/${String(mm).padStart(2,"0")}</span>`;

    html += `
      <div style="display:flex;align-items:center;gap:.75rem;padding:.5rem .75rem;
                  border-radius:10px;background:${isToday ? "rgba(234,179,8,.06)" : "rgba(255,255,255,.02)"};
                  border:1px solid ${isToday ? "rgba(234,179,8,.2)" : "transparent"};">
        ${avatarEl(b, 36)}
        <div style="flex:1;min-width:0;">
          <a href="../../pages/perfil/perfil.html?id=${b.discord_user_id}"
             style="font-weight:700;font-size:.88rem;color:#fff;text-decoration:none;">${b.username}</a>
        </div>
        <div style="font-size:.78rem;flex-shrink:0;">${dayLabel}</div>
      </div>
    `;
  });

  if (data.length) html += "</div></div>";
  listEl.innerHTML = html;
}

load();
