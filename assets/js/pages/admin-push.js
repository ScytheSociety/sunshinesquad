import { getUser, apiFetch } from "/assets/js/auth.js";

const ROLE_LVL = { admin:4, moderador:3, editor:2, miembro:1, visitante:0 };

function fmtDate(iso) {
  return new Date(iso).toLocaleString("es-ES", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

function typeBadge(type) {
  const cfg = { blog:"📝 Blog", event:"📅 Evento", birthday:"🎂 Cumpleaños", tierlist:"🏅 Tier List", manual:"✍️ Manual" };
  return `<span style="font-size:.68rem;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);
                       border-radius:6px;padding:.1rem .4rem;color:rgba(255,255,255,.5);">${cfg[type]||type}</span>`;
}

async function loadStats() {
  const res = await apiFetch("/push/stats");
  if (!res || !res.ok) return;
  const d = await res.json();
  document.getElementById("stat-subs").textContent      = d.total_subscriptions ?? "—";
  document.getElementById("stat-logged").textContent    = d.logged_in ?? "—";
  document.getElementById("stat-sent").textContent      = d.notifications_sent ?? "—";
  document.getElementById("stat-delivered").textContent = d.total_delivered ?? "—";
}

async function loadLog() {
  const el  = document.getElementById("push-log");
  const res = await apiFetch("/push/log?limit=30");
  if (!res || !res.ok) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;">No disponible.</div>`; return; }
  const rows = await res.json();
  if (!rows.length) { el.innerHTML = `<div style="color:rgba(255,255,255,.3);font-size:.85rem;">Sin envíos aún.</div>`; return; }
  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,.08);font-size:.68rem;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.4px;">
            <th style="padding:.4rem .6rem;text-align:left;">Tipo</th>
            <th style="padding:.4rem .6rem;text-align:left;">Título</th>
            <th style="padding:.4rem .6rem;text-align:right;">Enviadas</th>
            <th style="padding:.4rem .6rem;text-align:left;">Fecha</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr style="border-bottom:1px solid rgba(255,255,255,.04);">
              <td style="padding:.5rem .6rem;">${typeBadge(r.type)}</td>
              <td style="padding:.5rem .6rem;font-size:.82rem;color:#fff;">${r.title || "—"}</td>
              <td style="padding:.5rem .6rem;text-align:right;font-size:.85rem;font-weight:700;color:#a5b4fc;">${r.sent_count ?? 0}</td>
              <td style="padding:.5rem .6rem;font-size:.72rem;color:rgba(255,255,255,.3);white-space:nowrap;">${fmtDate(r.created_at)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function sendNotification() {
  const title  = document.getElementById("push-title").value.trim();
  const body   = document.getElementById("push-body").value.trim();
  const url    = document.getElementById("push-url").value.trim() || "https://sunshinesquad.es";
  const result = document.getElementById("push-result");
  const btn    = document.getElementById("send-btn");

  if (!title) { alert("El título es requerido."); return; }

  btn.disabled = true;
  btn.textContent = "Enviando…";
  result.style.display = "none";

  const res = await apiFetch("/push/send", {
    method: "POST",
    body: JSON.stringify({ title, body, url, type: "manual" }),
  });

  btn.disabled    = false;
  btn.textContent = "🔔 Enviar a todos";

  if (!res) return;
  const d = await res.json();

  result.style.display = "";
  if (res.ok) {
    result.style.background = "rgba(34,197,94,.12)";
    result.style.border     = "1px solid rgba(34,197,94,.3)";
    result.style.color      = "#86efac";
    result.textContent      = `✅ Enviado a ${d.sent} suscriptores${d.failed ? ` (${d.failed} fallidos)` : ""}.`;
    loadStats(); loadLog();
  } else {
    result.style.background = "rgba(239,68,68,.12)";
    result.style.border     = "1px solid rgba(239,68,68,.3)";
    result.style.color      = "#fca5a5";
    result.textContent      = `❌ Error: ${d.error || "desconocido"}`;
  }
}

// ── Init ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const user = getUser();
  if (!user || (ROLE_LVL[user.role] || 0) < 3) {
    document.getElementById("access-denied").style.display = "";
    return;
  }
  document.getElementById("push-content").style.display = "";
  loadStats();
  loadLog();
  document.getElementById("send-btn").addEventListener("click", sendNotification);
});
