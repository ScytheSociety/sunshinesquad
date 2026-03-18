const webPush = require("web-push");
const { webDB } = require("../db/web");

function initVapid() {
  webPush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "admin@sunshinesquad.es"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const PREF_KEY = { blog: "pref_blog", event: "pref_event", birthday: "pref_birthday", tierlist: "pref_tierlist" };

// sendPush({ type, title, body, url, icon, target, sentBy })
// type: 'blog' | 'event' | 'birthday' | 'tierlist' | 'manual'
// target: 'all' (default) — future: 'game:ragnarok'
async function sendPush({ type = "manual", title, body, url, icon, target = "all", sentBy = null }) {
  try { initVapid(); } catch { return { sent: 0, failed: 0, error: "VAPID not configured" }; }

  const db   = webDB();
  const subs = db.prepare("SELECT * FROM push_subscriptions").all();

  const prefKey = PREF_KEY[type];

  const filtered = subs.filter(sub => {
    if (!prefKey || !sub.user_id) return true; // anonymous → always include; manual → always include
    const pref = db.prepare(`SELECT ${prefKey} FROM push_preferences WHERE user_id=?`).get(sub.user_id);
    // If no row → use default (all enabled except tierlist)
    if (!pref) return type !== "tierlist";
    return pref[prefKey] !== 0;
  });

  const payload = JSON.stringify({
    title: title || "Sunshine Squad",
    body:  body  || "",
    icon:  icon  || "https://em-content.zobj.net/source/twitter/376/sun_2600-fe0f.png",
    url:   url   || "https://sunshinesquad.es",
  });

  let sentCount = 0, failedCount = 0;

  await Promise.all(filtered.map(async sub => {
    try {
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sentCount++;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        try { db.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").run(sub.endpoint); } catch {}
      } else {
        failedCount++;
      }
    }
  }));

  try {
    db.prepare(
      `INSERT INTO push_log (sent_by, type, title, body, url, target, sent_count, failed_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(sentBy, type, title, body, url || null, target, sentCount, failedCount);
  } catch {}

  return { sent: sentCount, failed: failedCount };
}

module.exports = { sendPush };
