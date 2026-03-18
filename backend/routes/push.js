const express  = require("express");
const router   = express.Router();
const webPush  = require("web-push");
const { webDB } = require("../db/web");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sendPush } = require("../utils/pushHelper");

webPush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || "admin@sunshinesquad.es"}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// GET /api/push/vapid-public-key
router.get("/vapid-public-key", (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe
router.post("/subscribe", (req, res) => {
  const { endpoint, keys, user_id } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Suscripción inválida" });
  }
  webDB().prepare(`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth, user_id=COALESCE(excluded.user_id, user_id)
  `).run(endpoint, keys.p256dh, keys.auth, user_id || null);

  res.json({ ok: true });
});

// DELETE /api/push/unsubscribe
router.delete("/unsubscribe", (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) webDB().prepare("DELETE FROM push_subscriptions WHERE endpoint=?").run(endpoint);
  res.json({ ok: true });
});

// GET /api/push/preferences — preferencias del usuario autenticado
router.get("/preferences", requireAuth, (req, res) => {
  const pref = webDB().prepare(
    "SELECT * FROM push_preferences WHERE user_id=?"
  ).get(req.user.id);

  res.json(pref || {
    user_id:       req.user.id,
    pref_blog:     1,
    pref_event:    1,
    pref_birthday: 1,
    pref_tierlist: 0,
  });
});

// PUT /api/push/preferences — guardar preferencias
router.put("/preferences", requireAuth, (req, res) => {
  const { pref_blog, pref_event, pref_birthday, pref_tierlist } = req.body;
  webDB().prepare(`
    INSERT INTO push_preferences (user_id, pref_blog, pref_event, pref_birthday, pref_tierlist, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      pref_blog=excluded.pref_blog, pref_event=excluded.pref_event,
      pref_birthday=excluded.pref_birthday, pref_tierlist=excluded.pref_tierlist,
      updated_at=excluded.updated_at
  `).run(
    req.user.id,
    pref_blog    !== undefined ? (pref_blog    ? 1 : 0) : 1,
    pref_event   !== undefined ? (pref_event   ? 1 : 0) : 1,
    pref_birthday !== undefined ? (pref_birthday ? 1 : 0) : 1,
    pref_tierlist !== undefined ? (pref_tierlist ? 1 : 0) : 0,
  );
  res.json({ ok: true });
});

// GET /api/push/stats — admin
router.get("/stats", requireRole("moderador"), (req, res) => {
  const db = webDB();
  const total    = db.prepare("SELECT COUNT(*) as n FROM push_subscriptions").get().n;
  const loggedIn = db.prepare("SELECT COUNT(*) as n FROM push_subscriptions WHERE user_id IS NOT NULL").get().n;
  const sent     = db.prepare("SELECT COUNT(*) as n, COALESCE(SUM(sent_count),0) as total FROM push_log").get();
  res.json({ total_subscriptions: total, logged_in: loggedIn, notifications_sent: sent.n, total_delivered: sent.total });
});

// GET /api/push/log — historial de notificaciones (admin)
router.get("/log", requireRole("moderador"), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const rows  = webDB().prepare(
    "SELECT * FROM push_log ORDER BY created_at DESC LIMIT ?"
  ).all(limit);
  res.json(rows);
});

// POST /api/push/send — envío manual (admin) o interno (localhost)
router.post("/send", async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || "";
  const isLocal = ["::1","127.0.0.1","::ffff:127.0.0.1"].includes(ip);

  // Verificar autorización: admin via JWT o localhost
  if (!isLocal) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No autorizado" });
    try {
      const jwt   = require("jsonwebtoken");
      const user  = jwt.verify(token, process.env.JWT_SECRET);
      const lvl   = { admin:4, moderador:3, editor:2, miembro:1, visitante:0 };
      if ((lvl[user.role] || 0) < 3) return res.status(403).json({ error: "Sin permisos" });
      req.user = user;
    } catch { return res.status(401).json({ error: "Token inválido" }); }
  }

  const { title, body, icon, url, type = "manual", target = "all" } = req.body;
  if (!title) return res.status(400).json({ error: "title requerido" });

  const result = await sendPush({
    type, title, body, icon, url, target,
    sentBy: req.user?.id || "system",
  });
  res.json(result);
});

module.exports = router;
