const express  = require("express");
const router   = express.Router();
const { botDB } = require("../db/bot");
const { requireRole } = require("../middleware/auth");

// GET /api/mvp
router.get("/", (req, res) => {
  try {
    const db = botDB();
    const mvps = db.prepare(`
      SELECT
        mk.id,
        mb.nombre        AS boss_name,
        mk.death_time    AS killed_at,
        mk.respawn_time  AS respawn_at,
        mk.status,
        mk.navigation,
        mb.hora_respawn,
        mb.nombre_mapa   AS map,
        mb.imagen        AS image_url,
        mb.categoria
      FROM mvp_kills mk
      LEFT JOIN mvp_bosses mb ON mk.mvp_id = mb.id
      WHERE mk.status = 'active'
      ORDER BY mk.respawn_time ASC
      LIMIT 20
    `).all();
    res.json(mvps);
  } catch (err) {
    console.error("mvp:", err);
    res.status(500).json({ error: "Error al obtener MVPs" });
  }
});

// GET /api/mvp/next
router.get("/next", (req, res) => {
  try {
    const db  = botDB();
    const now = new Date().toISOString();
    const mvp = db.prepare(`
      SELECT
        mb.nombre       AS boss_name,
        mk.respawn_time AS respawn_at,
        mk.status,
        mk.navigation,
        mb.nombre_mapa  AS map,
        mb.imagen       AS image_url,
        mb.hora_respawn
      FROM mvp_kills mk
      LEFT JOIN mvp_bosses mb ON mk.mvp_id = mb.id
      WHERE mk.status = 'active' AND mk.respawn_time > ?
      ORDER BY mk.respawn_time ASC
      LIMIT 1
    `).get(now);
    res.json(mvp || null);
  } catch (err) {
    console.error("mvp/next:", err);
    res.status(500).json({ error: "Error al obtener próximo MVP" });
  }
});

// ── ADMIN ─────────────────────────────────────────────────────────────

// GET /api/mvp/admin/stats
router.get("/admin/stats", requireRole("moderador"), (req, res) => {
  try {
    const db = botDB();
    const total       = db.prepare("SELECT COUNT(*) as c FROM mvp_kills").get().c;
    const active      = db.prepare("SELECT COUNT(*) as c FROM mvp_kills WHERE status='active'").get().c;
    const hunters     = db.prepare("SELECT COUNT(DISTINCT user_id) as c FROM mvp_kills").get().c;
    const bosses      = db.prepare("SELECT COUNT(*) as c FROM mvp_bosses WHERE is_active=1").get().c;
    const topBoss     = db.prepare(`
      SELECT mb.nombre, COUNT(*) as cnt
      FROM mvp_kills mk JOIN mvp_bosses mb ON mb.id=mk.mvp_id
      GROUP BY mk.mvp_id ORDER BY cnt DESC LIMIT 1
    `).get();
    res.json({ total, active, hunters, bosses, top_boss: topBoss?.nombre || "—" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mvp/admin/kills?status=all|active|expired&limit=50
router.get("/admin/kills", requireRole("moderador"), (req, res) => {
  try {
    const db     = botDB();
    const status = req.query.status || "all";
    const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
    const where  = status === "all" ? "" : "WHERE mk.status = ?";
    const params = status === "all" ? [limit] : [status, limit];
    const kills  = db.prepare(`
      SELECT mk.id, mb.nombre AS boss_name, mb.imagen AS boss_img,
             mb.nombre_mapa AS map, mb.categoria,
             mk.user_id AS hunter_id, mk.death_time AS killed_at,
             mk.respawn_time AS respawn_at, mk.status,
             mk.navigation, mb.hora_respawn
      FROM mvp_kills mk
      LEFT JOIN mvp_bosses mb ON mb.id = mk.mvp_id
      ${where}
      ORDER BY mk.created_at DESC
      LIMIT ?
    `).all(...params);

    // enrich with username from bot users table
    kills.forEach(k => {
      const u = db.prepare("SELECT display_name FROM users WHERE discord_user_id=? LIMIT 1").get(k.hunter_id);
      k.hunter_name = u?.display_name || k.hunter_id;
    });

    res.json(kills);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/mvp/admin/kill/:id
router.delete("/admin/kill/:id", requireRole("moderador"), (req, res) => {
  try {
    const db = botDB();
    const r  = db.prepare("DELETE FROM mvp_kills WHERE id=?").run(req.params.id);
    if (r.changes === 0) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/mvp/admin/bosses
router.get("/admin/bosses", requireRole("moderador"), (req, res) => {
  try {
    const db     = botDB();
    const bosses = db.prepare(`
      SELECT mb.*,
        (SELECT COUNT(*) FROM mvp_kills mk WHERE mk.mvp_id=mb.id) as total_kills
      FROM mvp_bosses mb
      ORDER BY mb.categoria, mb.nombre
    `).all();
    res.json(bosses);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/mvp/admin/boss/:id  — toggle active + update respawn
router.put("/admin/boss/:id", requireRole("moderador"), (req, res) => {
  try {
    const db  = botDB();
    const row = db.prepare("SELECT * FROM mvp_bosses WHERE id=?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "No encontrado" });

    const is_active   = req.body.is_active   ?? row.is_active;
    const hora_respawn = req.body.hora_respawn ?? row.hora_respawn;
    db.prepare("UPDATE mvp_bosses SET is_active=?, hora_respawn=? WHERE id=?")
      .run(is_active ? 1 : 0, hora_respawn, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
