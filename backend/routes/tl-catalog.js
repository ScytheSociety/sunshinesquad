const express = require("express");
const router  = express.Router();
const { webDB } = require("../db/web");
const { requireRole } = require("../middleware/auth");

function ensureTables() {
  webDB().exec(`
    CREATE TABLE IF NOT EXISTS tl_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      game_key        TEXT NOT NULL,
      name            TEXT NOT NULL,
      image_url       TEXT,
      image_url_f     TEXT,
      is_dual_weapon  INTEGER DEFAULT 0,
      category        TEXT DEFAULT 'general',
      sort_order      INTEGER DEFAULT 0,
      created_at      TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tl_roles (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      game_key   TEXT NOT NULL,
      role_name  TEXT NOT NULL,
      icon       TEXT DEFAULT '⚔️',
      color      TEXT DEFAULT '#6b7280',
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tl_skills (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      game_key   TEXT NOT NULL,
      name       TEXT NOT NULL,
      image_url  TEXT,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tl_talents (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      game_key   TEXT NOT NULL,
      name       TEXT NOT NULL,
      image_url  TEXT,
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tl_game_covers (
      game_key   TEXT PRIMARY KEY,
      image_url  TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ── GET /api/tl-catalog/:game/cover ───────────────────────────────
router.get("/:game/cover", (req, res) => {
  ensureTables();
  const row = webDB().prepare("SELECT image_url FROM tl_game_covers WHERE game_key=?").get(req.params.game);
  res.json({ image_url: row ? row.image_url : null });
});

// ── PUT /api/tl-catalog/:game/cover ───────────────────────────────
router.put("/:game/cover", requireRole("editor"), (req, res) => {
  ensureTables();
  const { image_url } = req.body;
  if (!image_url) return res.status(400).json({ error: "URL requerida" });
  webDB().prepare(
    "INSERT INTO tl_game_covers (game_key, image_url, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(game_key) DO UPDATE SET image_url=excluded.image_url, updated_at=excluded.updated_at"
  ).run(req.params.game, image_url);
  res.json({ ok: true });
});

// ── GET /api/tl-catalog/games ──────────────────────────────────────
router.get("/games", (_req, res) => {
  res.json([
    { key: "ragnarok",        name: "Ragnarok Online",  has_gender: true  },
    { key: "wow",             name: "World of Warcraft", has_gender: false },
    { key: "lineage2",        name: "Lineage 2",         has_gender: false },
    { key: "brawlstars",      name: "Brawl Stars",       has_gender: false },
    { key: "throneandliberty",name: "Throne & Liberty",  has_gender: false },
  ]);
});

// ── GET /api/tl-catalog/:game/items ───────────────────────────────
router.get("/:game/items", (req, res) => {
  ensureTables();
  const rows = webDB().prepare(
    "SELECT * FROM tl_items WHERE game_key=? ORDER BY sort_order, name"
  ).all(req.params.game);
  res.json(rows);
});

// ── GET /api/tl-catalog/:game/roles ───────────────────────────────
router.get("/:game/roles", (req, res) => {
  ensureTables();
  const rows = webDB().prepare(
    "SELECT * FROM tl_roles WHERE game_key=? ORDER BY sort_order, role_name"
  ).all(req.params.game);
  res.json(rows);
});

// ── GET /api/tl-catalog/:game/skills ──────────────────────────────
router.get("/:game/skills", (req, res) => {
  ensureTables();
  const rows = webDB().prepare(
    "SELECT * FROM tl_skills WHERE game_key=? ORDER BY sort_order, name"
  ).all(req.params.game);
  res.json(rows);
});

// ── POST /api/tl-catalog/:game/items ──────────────────────────────
router.post("/:game/items", requireRole("editor"), (req, res) => {
  ensureTables();
  const { name, image_url, image_url_f, is_dual_weapon, category, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: "Nombre requerido" });
  const r = webDB().prepare(
    "INSERT INTO tl_items (game_key,name,image_url,image_url_f,is_dual_weapon,category,sort_order) VALUES (?,?,?,?,?,?,?)"
  ).run(req.params.game, name, image_url||null, image_url_f||null, is_dual_weapon?1:0, category||"general", sort_order||0);
  res.json({ id: r.lastInsertRowid, name, image_url, image_url_f, category, game_key: req.params.game });
});

// ── PUT /api/tl-catalog/items/:id ─────────────────────────────────
router.put("/items/:id", requireRole("editor"), (req, res) => {
  ensureTables();
  const { name, image_url, image_url_f, is_dual_weapon, category, sort_order } = req.body;
  webDB().prepare(
    "UPDATE tl_items SET name=?,image_url=?,image_url_f=?,is_dual_weapon=?,category=?,sort_order=? WHERE id=?"
  ).run(name, image_url||null, image_url_f||null, is_dual_weapon?1:0, category||"general", sort_order||0, req.params.id);
  res.json({ ok: true });
});

// ── POST /api/tl-catalog/:game/skills ─────────────────────────────
router.post("/:game/skills", requireRole("editor"), (req, res) => {
  ensureTables();
  const { name, image_url, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: "Nombre requerido" });
  const r = webDB().prepare(
    "INSERT INTO tl_skills (game_key,name,image_url,sort_order) VALUES (?,?,?,?)"
  ).run(req.params.game, name, image_url||null, sort_order||0);
  res.json({ id: r.lastInsertRowid });
});

// ── PUT /api/tl-catalog/skills/:id ────────────────────────────────
router.put("/skills/:id", requireRole("editor"), (req, res) => {
  ensureTables();
  const { name, image_url, sort_order } = req.body;
  webDB().prepare("UPDATE tl_skills SET name=?,image_url=?,sort_order=? WHERE id=?")
    .run(name, image_url||null, sort_order||0, req.params.id);
  res.json({ ok: true });
});

// ── DELETE /api/tl-catalog/skills/:id ─────────────────────────────
router.delete("/skills/:id", requireRole("editor"), (req, res) => {
  ensureTables();
  webDB().prepare("DELETE FROM tl_skills WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ── DELETE /api/tl-catalog/items/:id ──────────────────────────────
router.delete("/items/:id", requireRole("editor"), (req, res) => {
  ensureTables();
  webDB().prepare("DELETE FROM tl_items WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ── POST /api/tl-catalog/:game/roles ──────────────────────────────
router.post("/:game/roles", requireRole("editor"), (req, res) => {
  ensureTables();
  const { role_name, icon, color, sort_order } = req.body;
  if (!role_name) return res.status(400).json({ error: "Nombre requerido" });
  const r = webDB().prepare(
    "INSERT INTO tl_roles (game_key,role_name,icon,color,sort_order) VALUES (?,?,?,?,?)"
  ).run(req.params.game, role_name, icon||"⚔️", color||"#6b7280", sort_order||0);
  res.json({ id: r.lastInsertRowid });
});

// ── PUT /api/tl-catalog/roles/:id ─────────────────────────────────
router.put("/roles/:id", requireRole("editor"), (req, res) => {
  ensureTables();
  const { role_name, icon, color, sort_order } = req.body;
  webDB().prepare(
    "UPDATE tl_roles SET role_name=?,icon=?,color=?,sort_order=? WHERE id=?"
  ).run(role_name, icon||"⚔️", color||"#6b7280", sort_order||0, req.params.id);
  res.json({ ok: true });
});

// ── DELETE /api/tl-catalog/roles/:id ──────────────────────────────
router.delete("/roles/:id", requireRole("editor"), (req, res) => {
  ensureTables();
  webDB().prepare("DELETE FROM tl_roles WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ── GET /api/tl-catalog/:game/talents ─────────────────────────────
router.get("/:game/talents", (req, res) => {
  ensureTables();
  const rows = webDB().prepare(
    "SELECT * FROM tl_talents WHERE game_key=? ORDER BY sort_order, name"
  ).all(req.params.game);
  res.json(rows);
});

// ── POST /api/tl-catalog/:game/talents ────────────────────────────
router.post("/:game/talents", requireRole("editor"), (req, res) => {
  ensureTables();
  const { name, image_url, sort_order } = req.body;
  if (!name) return res.status(400).json({ error: "Nombre requerido" });
  const r = webDB().prepare(
    "INSERT INTO tl_talents (game_key,name,image_url,sort_order) VALUES (?,?,?,?)"
  ).run(req.params.game, name, image_url||null, sort_order||0);
  res.json({ id: r.lastInsertRowid });
});

// ── PUT /api/tl-catalog/talents/:id ───────────────────────────────
router.put("/talents/:id", requireRole("editor"), (req, res) => {
  ensureTables();
  const { name, image_url, sort_order } = req.body;
  webDB().prepare("UPDATE tl_talents SET name=?,image_url=?,sort_order=? WHERE id=?")
    .run(name, image_url||null, sort_order||0, req.params.id);
  res.json({ ok: true });
});

// ── DELETE /api/tl-catalog/talents/:id ────────────────────────────
router.delete("/talents/:id", requireRole("editor"), (req, res) => {
  ensureTables();
  webDB().prepare("DELETE FROM tl_talents WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ── POST /api/tl-catalog/:game/seed (admin) — seed defaults ───────
router.post("/:game/seed", requireRole("admin"), (req, res) => {
  ensureTables();
  const { items = [], roles = [], skills = [], talents = [] } = req.body;
  const db = webDB();

  const stmtI = db.prepare(
    "INSERT OR IGNORE INTO tl_items (game_key,name,image_url,image_url_f,is_dual_weapon,category,sort_order) VALUES (?,?,?,?,?,?,?)"
  );
  items.forEach((it, i) => {
    stmtI.run(req.params.game, it.name, it.image_url||null, it.image_url_f||null, it.is_dual_weapon?1:0, it.category||"general", it.sort_order??i);
  });

  const stmtR = db.prepare(
    "INSERT OR IGNORE INTO tl_roles (game_key,role_name,icon,color,sort_order) VALUES (?,?,?,?,?)"
  );
  roles.forEach((ro, i) => {
    stmtR.run(req.params.game, ro.role_name, ro.icon||"⚔️", ro.color||"#6b7280", ro.sort_order??i);
  });

  const stmtS = db.prepare(
    "INSERT OR IGNORE INTO tl_skills (game_key,name,image_url,sort_order) VALUES (?,?,?,?)"
  );
  skills.forEach((sk, i) => {
    stmtS.run(req.params.game, sk.name, sk.image_url||null, sk.sort_order??i);
  });

  const stmtT = db.prepare(
    "INSERT OR IGNORE INTO tl_talents (game_key,name,image_url,sort_order) VALUES (?,?,?,?)"
  );
  talents.forEach((t, i) => {
    stmtT.run(req.params.game, t.name, t.image_url||null, t.sort_order??i);
  });

  res.json({ ok: true, items_added: items.length, roles_added: roles.length, skills_added: skills.length, talents_added: talents.length });
});

module.exports = router;
