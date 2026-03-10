import { loadJson } from "../app.js";
import { apiFetch } from "../auth.js";

const API = "https://sunshinesquad.es/api";

// ── Twitch embeds ──────────────────────────────────────────────────
function buildPlayer(ch) { return `https://player.twitch.tv/?channel=${ch}&parent=${window.location.hostname}&autoplay=true&muted=false`; }
function buildChat(ch)   { return `https://www.twitch.tv/embed/${ch}/chat?parent=${window.location.hostname}`; }
function setStream(ch) {
  document.getElementById("stream-iframe").src = buildPlayer(ch);
  document.getElementById("chat-iframe").src   = buildChat(ch);
}
function matchChatHeight() {
  const p = document.getElementById("player-wrap");
  const c = document.getElementById("chat-wrap");
  if (!p || !c) return;
  const h = p.offsetWidth * 9 / 16;
  c.style.height = h + "px";
  document.getElementById("chat-iframe").style.height = h + "px";
}
window.addEventListener("load",   matchChatHeight);
window.addEventListener("resize", matchChatHeight);

function renderChannels(channels) {
  const list = document.getElementById("channel-list");
  if (!list) return;
  channels.forEach((item, idx) => {
    const btn = document.createElement("button");
    btn.className   = "btn-ss";
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

// ── Conversión timezone → local ────────────────────────────────────
function toLocal(fechaISO, horaStr, timezone = "America/Lima") {
  const isoStr = `${fechaISO}T${horaStr}:00`;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false
  });
  const utcRef = new Date(isoStr + "Z");
  const parts  = fmt.formatToParts(utcRef).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
  const tzDate = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
  return new Date(utcRef.getTime() + (utcRef - tzDate));
}

function getEstado(inicio, durH) {
  const ahora = new Date();
  const fin   = new Date(inicio.getTime() + (durH + 1) * 3600000);
  if (ahora < inicio) return "futuro";
  if (ahora < fin)    return "activo";
  return "pasado";
}

// ── Eventos próximos ────────────────────────────────────────────────
function renderEventosIndex(eventos) {
  const wrap = document.getElementById("eventos-activos");
  if (!wrap) return;
  const ahora  = new Date();
  const limite = new Date(ahora.getTime() + 7 * 24 * 3600000);
  const relevantes = eventos
    .map(ev => ({ ...ev, inicio: toLocal(ev.fecha, ev.hora, ev.timezone || "America/Lima") }))
    .map(ev => ({ ...ev, estado: getEstado(ev.inicio, ev.duracion) }))
    .filter(ev => ev.estado !== "pasado" && ev.inicio <= limite)
    .sort((a, b) => a.inicio - b.inicio)
    .slice(0, 5);
  if (!relevantes.length) { wrap.style.display = "none"; return; }
  wrap.style.display = "block";
  const strip = document.getElementById("eventos-strip");
  if (!strip) return;
  strip.innerHTML = "";
  const cfg = {
    activo: { bg:"rgba(34,197,94,.18)",  border:"rgba(34,197,94,.4)",  text:"#bbf7d0", label:"🟢 En curso" },
    futuro: { bg:"rgba(99,102,241,.18)", border:"rgba(99,102,241,.4)", text:"#c7d2fe", label:"🔵 Próximo"  }
  };
  relevantes.forEach(ev => {
    const c    = cfg[ev.estado] || cfg.futuro;
    const hora = ev.inicio.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", hour12:true });
    const fLbl = ev.inicio.toLocaleDateString("es", { weekday:"short", day:"numeric", month:"short" });
    const card = document.createElement("div");
    card.style.cssText = `flex-shrink:0;background:${c.bg};border:1px solid ${c.border};border-radius:12px;padding:.75rem 1rem;min-width:175px;max-width:215px;`;
    card.innerHTML = `
      <div style="font-size:.65rem;font-weight:700;color:${c.text};margin-bottom:.3rem;">${c.label}</div>
      <div style="font-weight:700;font-size:.85rem;color:#fff;line-height:1.2;margin-bottom:.2rem;">${ev.juego}</div>
      <div style="font-size:.78rem;color:rgba(255,255,255,.55);margin-bottom:.3rem;">${ev.evento}</div>
      <div style="font-size:.7rem;color:rgba(255,255,255,.35);">${fLbl} · ${hora}</div>`;
    strip.appendChild(card);
  });
}

// ── MVP Tracker ─────────────────────────────────────────────────────
let mvpTimer = null;

function fmtCountdown(ms) {
  if (ms <= 0) return "¡Spawneando!";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [h > 0 ? `${h}h` : null, `${String(m).padStart(2,"0")}m`, `${String(s).padStart(2,"0")}s`].filter(Boolean).join(" ");
}

async function renderMVP() {
  const el = document.getElementById("mvp-content");
  const badge = document.getElementById("mvp-live-badge");
  if (!el) return;

  try {
    const res  = await fetch(`${API}/mvp/next`);
    const mvp  = await res.json();

    if (!mvp || !mvp.respawn_at) {
      el.innerHTML = `<div style="color:rgba(255,255,255,.35);font-size:.85rem;">No hay MVPs registrados próximamente.</div>`;
      return;
    }

    const respawnDate = new Date(mvp.respawn_at);

    if (mvpTimer) clearInterval(mvpTimer);
    mvpTimer = setInterval(() => {
      const countdown = document.getElementById("mvp-countdown");
      if (!countdown) { clearInterval(mvpTimer); return; }
      const diff = respawnDate - new Date();
      countdown.textContent = fmtCountdown(diff);
      if (badge) badge.style.display = diff <= 5 * 60000 ? "inline" : "none";
    }, 1000);

    const diff = respawnDate - new Date();
    el.innerHTML = `
      <div class="d-flex align-items-center gap-3">
        ${mvp.image_url ? `<img src="${mvp.image_url}" alt="${mvp.boss_name}" style="width:64px;height:64px;object-fit:contain;border-radius:10px;background:rgba(255,255,255,.05);">` : ""}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:1rem;color:#fff;margin-bottom:.2rem;">${mvp.boss_name}</div>
          <div style="font-size:.78rem;color:rgba(255,255,255,.45);margin-bottom:.5rem;">📍 ${mvp.map || "Desconocido"}</div>
          <div style="font-size:.72rem;color:rgba(255,255,255,.35);margin-bottom:.3rem;">Spawn en</div>
          <div id="mvp-countdown" style="font-size:1.4rem;font-weight:900;font-variant-numeric:tabular-nums;color:#fbbf24;letter-spacing:.5px;">${fmtCountdown(diff)}</div>
          <div style="font-size:.7rem;color:rgba(255,255,255,.25);margin-top:.2rem;">
            ${mvp.min_respawn && mvp.max_respawn ? `Ventana: ${mvp.min_respawn}–${mvp.max_respawn} min` : ""}
          </div>
        </div>
      </div>`;
  } catch {
    el.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:.82rem;">MVP Tracker no disponible.</div>`;
  }
}

// ── Cumpleaños ──────────────────────────────────────────────────────
async function renderBirthdays() {
  const el = document.getElementById("birthday-content");
  if (!el) return;
  try {
    const res   = await fetch(`${API}/birthdays`);
    const items = await res.json();
    if (!items.length) {
      el.innerHTML = `<div style="color:rgba(255,255,255,.35);font-size:.85rem;">Sin cumpleaños esta semana.</div>`;
      return;
    }
    el.innerHTML = items.map(b => {
      const label = b.dias_faltantes === 0 ? "🎉 ¡Hoy!" : `en ${b.dias_faltantes} día${b.dias_faltantes !== 1 ? "s" : ""}`;
      const color = b.dias_faltantes === 0 ? "#fde047" : "rgba(255,255,255,.55)";
      return `
        <div class="d-flex align-items-center gap-2 mb-2">
          ${b.avatar_url ? `<img src="${b.avatar_url}" alt="${b.username}" width="32" height="32" style="border-radius:50%;object-fit:cover;">` : `<div style="width:32px;height:32px;border-radius:50%;background:rgba(99,102,241,.3);display:flex;align-items:center;justify-content:center;font-size:.8rem;">🎂</div>`}
          <div style="flex:1;min-width:0;">
            <div style="font-size:.85rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.username}</div>
            <div style="font-size:.72rem;color:${color};">${b.birthday} · ${label}</div>
          </div>
        </div>`;
    }).join("");
  } catch {
    el.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:.82rem;">Cumpleaños no disponible.</div>`;
  }
}

// ── Ranking TOP 5 ───────────────────────────────────────────────────
const MEDALLAS = ["🥇","🥈","🥉","4️⃣","5️⃣"];

async function renderRanking() {
  const el = document.getElementById("ranking-content");
  if (!el) return;
  try {
    const res   = await fetch(`${API}/ranking?limit=5`);
    const items = await res.json();
    if (!items.length) {
      el.innerHTML = `<div style="color:rgba(255,255,255,.35);font-size:.85rem;">Sin datos de ranking.</div>`;
      return;
    }
    el.innerHTML = items.map((u, i) => `
      <div class="ranking-row" style="border-radius:10px;padding:.6rem .75rem;margin-bottom:.4rem;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);cursor:pointer;"
           onclick="this.querySelector('.ranking-detail').style.display = this.querySelector('.ranking-detail').style.display==='none'?'block':'none'">
        <div class="d-flex align-items-center gap-3">
          <div style="font-size:1.1rem;min-width:28px;text-align:center;">${MEDALLAS[i]}</div>
          ${u.avatar_url ? `<img src="${u.avatar_url}" alt="${u.username}" width="36" height="36" style="border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.1);">` : `<div style="width:36px;height:36px;border-radius:50%;background:rgba(99,102,241,.2);"></div>`}
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:.9rem;color:#fff;">${u.username}</div>
            <div style="font-size:.72rem;color:rgba(255,255,255,.4);">${u.logros?.length ? u.logros[0].name : "Sin logros aún"}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1rem;font-weight:900;color:#fbbf24;">${u.puntos_totales?.toLocaleString() ?? 0}</div>
            <div style="font-size:.7rem;color:rgba(255,255,255,.3);">pts</div>
          </div>
        </div>
        <div class="ranking-detail" style="display:none;margin-top:.75rem;padding-top:.75rem;border-top:1px solid rgba(255,255,255,.07);">
          ${u.juegos?.map(j => `
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span style="font-size:.78rem;color:rgba(255,255,255,.5);">${j.game}</span>
              <span style="font-size:.78rem;color:#a5b4fc;font-weight:600;">${j.points?.toLocaleString()} pts${j.rank_name ? ` · ${j.rank_name}` : ""}</span>
            </div>`).join("") ?? ""}
          ${u.logros?.length ? `<div style="margin-top:.5rem;display:flex;flex-wrap:wrap;gap:.3rem;">
            ${u.logros.map(l => `<span style="font-size:.7rem;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);color:#fde68a;border-radius:999px;padding:.15rem .5rem;">${l.icon || "⭐"} ${l.name}</span>`).join("")}
          </div>` : ""}
        </div>
      </div>`).join("");
  } catch {
    el.innerHTML = `<div style="color:rgba(255,255,255,.25);font-size:.82rem;">Ranking no disponible.</div>`;
  }
}

// ── Init ────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Streams
  try {
    const streams = await loadJson("data/streams.json");
    renderChannels(streams.channels);
    setTimeout(matchChatHeight, 100);
  } catch(e) { console.error("streams.json:", e); }

  // Eventos (schedule.json local como fallback)
  try {
    const sched = await loadJson("data/schedule.json");
    renderEventosIndex(sched.eventos);
  } catch(e) { console.error("schedule.json:", e); }

  // Widgets del API (no bloquean el resto si fallan)
  renderMVP();
  renderBirthdays();
  renderRanking();
});
