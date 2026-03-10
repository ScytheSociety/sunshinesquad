const express  = require("express");
const router   = express.Router();
const webPush  = require("web-push");
const { webDB } = require("../db/web");

webPush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || "admin@sunshinesquad.com"}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// GET /api/push/vapid-public-key
router.get("/vapid-public-key", (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe
router.post("/subscribe", (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Suscripción inválida" });
  }

  const db = webDB();
  db.prepare(`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth
  `).run(endpoint, keys.p256dh, keys.auth, req.body.user_id || null);

  res.json({ ok: true });
});

// POST /api/push/send  → uso interno (llamado desde cron/bot)
// Solo acepta requests del mismo servidor (localhost)
router.post("/send", (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!["::1", "127.0.0.1", "::ffff:127.0.0.1"].includes(ip)) {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  const { title, body, icon, url } = req.body;
  const db = webDB();
  const subs = db.prepare("SELECT * FROM push_subscriptions").all();

  const payload = JSON.stringify({ title, body, icon, url });
  const failed  = [];

  Promise.all(subs.map(async s => {
    try {
      await webPush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
    } catch (err) {
      if (err.statusCode === 410) {
        // Suscripción expirada, eliminar
        db.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").run(s.endpoint);
      } else {
        failed.push(s.endpoint);
      }
    }
  })).then(() => {
    res.json({ sent: subs.length - failed.length, failed: failed.length });
  });
});

module.exports = router;
