const { Router } = require("express");
const { requireRole } = require("../middleware/auth");
const { webDB } = require("../db/web");

const router = Router();

// Migrations
(function migrate() {
  const db = webDB();
  const stmts = [
    `CREATE TABLE IF NOT EXISTS game_media_gallery (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       game_key TEXT NOT NULL,
       url TEXT NOT NULL,
       titulo TEXT DEFAULT '',
       orden INTEGER DEFAULT 0,
       created_at TEXT DEFAULT (datetime('now'))
     )`,
    `CREATE TABLE IF NOT EXISTS game_media_videos (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       game_key TEXT NOT NULL,
       url TEXT NOT NULL,
       titulo TEXT DEFAULT '',
       orden INTEGER DEFAULT 0,
       created_at TEXT DEFAULT (datetime('now'))
     )`,
    `CREATE TABLE IF NOT EXISTS game_server_config (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       game_key TEXT NOT NULL UNIQUE,
       logo_url TEXT DEFAULT '',
       descripcion TEXT DEFAULT '',
       web TEXT DEFAULT '',
       wiki TEXT DEFAULT '',
       descarga TEXT DEFAULT '',
       discord TEXT DEFAULT '',
       updated_at TEXT DEFAULT (datetime('now'))
     )`,
    `CREATE TABLE IF NOT EXISTS game_server_info (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       game_key TEXT NOT NULL,
       label TEXT NOT NULL,
       valor TEXT NOT NULL,
       orden INTEGER DEFAULT 0
     )`,
  ];
  stmts.forEach(s => { try { db.prepare(s).run(); } catch {} });
})();

// GET /api/game-media/:key — all media for a game (public)
router.get("/:key", (req, res) => {
  try {
    const key = req.params.key;
    const db  = webDB();
    const gallery = db.prepare("SELECT * FROM game_media_gallery WHERE game_key=? ORDER BY orden ASC, id ASC").all(key);
    const videos  = db.prepare("SELECT * FROM game_media_videos  WHERE game_key=? ORDER BY orden ASC, id ASC").all(key);
    const cfg     = db.prepare("SELECT * FROM game_server_config WHERE game_key=?").get(key) || null;
    const info    = db.prepare("SELECT * FROM game_server_info   WHERE game_key=? ORDER BY orden ASC, id ASC").all(key);
    res.json({ gallery, videos, servidor: cfg ? { ...cfg, info } : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/game-media/:key/server — upsert server config + info rows (editor+)
router.put("/:key/server", requireRole("editor"), (req, res) => {
  try {
    const key = req.params.key;
    const { logo_url, descripcion, web, wiki, descarga, discord, info } = req.body;
    const db = webDB();

    db.prepare(`INSERT INTO game_server_config (game_key,logo_url,descripcion,web,wiki,descarga,discord,updated_at)
      VALUES (?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(game_key) DO UPDATE SET
        logo_url=excluded.logo_url, descripcion=excluded.descripcion,
        web=excluded.web, wiki=excluded.wiki, descarga=excluded.descarga,
        discord=excluded.discord, updated_at=excluded.updated_at`)
      .run(key, logo_url||"", descripcion||"", web||"", wiki||"", descarga||"", discord||"");

    // Replace info rows
    if (Array.isArray(info)) {
      db.prepare("DELETE FROM game_server_info WHERE game_key=?").run(key);
      const ins = db.prepare("INSERT INTO game_server_info (game_key,label,valor,orden) VALUES (?,?,?,?)");
      db.transaction(rows => rows.forEach((r, i) => ins.run(key, r.label||"", r.valor||"", i)))(info);
    }

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/game-media/:key/gallery — add image (editor+)
router.post("/:key/gallery", requireRole("editor"), (req, res) => {
  try {
    const key = req.params.key;
    const { url, titulo } = req.body;
    if (!url) return res.status(400).json({ error: "url requerida" });
    const db = webDB();
    const maxOrden = db.prepare("SELECT COALESCE(MAX(orden),0)+1 AS n FROM game_media_gallery WHERE game_key=?").get(key).n;
    const r = db.prepare("INSERT INTO game_media_gallery (game_key,url,titulo,orden) VALUES (?,?,?,?)").run(key, url, titulo||"", maxOrden);
    res.status(201).json(db.prepare("SELECT * FROM game_media_gallery WHERE id=?").get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/game-media/:key/gallery/:id — update image (editor+)
router.put("/:key/gallery/:id", requireRole("editor"), (req, res) => {
  try {
    const { url, titulo } = req.body;
    const db = webDB();
    db.prepare("UPDATE game_media_gallery SET url=?,titulo=? WHERE id=? AND game_key=?")
      .run(url||"", titulo||"", req.params.id, req.params.key);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/game-media/:key/gallery/:id (editor+)
router.delete("/:key/gallery/:id", requireRole("editor"), (req, res) => {
  try {
    webDB().prepare("DELETE FROM game_media_gallery WHERE id=? AND game_key=?").run(req.params.id, req.params.key);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/game-media/:key/videos — add video (editor+)
router.post("/:key/videos", requireRole("editor"), (req, res) => {
  try {
    const key = req.params.key;
    const { url, titulo } = req.body;
    if (!url) return res.status(400).json({ error: "url requerida" });
    const db = webDB();
    const maxOrden = db.prepare("SELECT COALESCE(MAX(orden),0)+1 AS n FROM game_media_videos WHERE game_key=?").get(key).n;
    const r = db.prepare("INSERT INTO game_media_videos (game_key,url,titulo,orden) VALUES (?,?,?,?)").run(key, url, titulo||"", maxOrden);
    res.status(201).json(db.prepare("SELECT * FROM game_media_videos WHERE id=?").get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/game-media/:key/videos/:id — update video (editor+)
router.put("/:key/videos/:id", requireRole("editor"), (req, res) => {
  try {
    const { url, titulo } = req.body;
    webDB().prepare("UPDATE game_media_videos SET url=?,titulo=? WHERE id=? AND game_key=?")
      .run(url||"", titulo||"", req.params.id, req.params.key);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/game-media/:key/videos/:id (editor+)
router.delete("/:key/videos/:id", requireRole("editor"), (req, res) => {
  try {
    webDB().prepare("DELETE FROM game_media_videos WHERE id=? AND game_key=?").run(req.params.id, req.params.key);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/game-media/:key/gallery/reorder (editor+)
router.post("/:key/gallery/reorder", requireRole("editor"), (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "ids debe ser array" });
    const upd = webDB().prepare("UPDATE game_media_gallery SET orden=? WHERE id=? AND game_key=?");
    webDB().transaction(ids => ids.forEach((id, i) => upd.run(i, id, req.params.key)))(ids);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
