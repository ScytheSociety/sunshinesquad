const express = require("express");
const router  = express.Router();
const { webDB } = require("../db/web");
const { requireAuth } = require("../middleware/auth");

// Asegura que la tabla exista
function ensureTable() {
  webDB().exec(`
    CREATE TABLE IF NOT EXISTS tierlist_saves (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      share_id    TEXT UNIQUE NOT NULL,
      titulo      TEXT NOT NULL DEFAULT 'Mi Tier List',
      juego       TEXT,
      tiers       TEXT NOT NULL,
      items       TEXT NOT NULL,
      autor_id    TEXT,
      autor_nombre TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );
  `);
}

function genId(len = 7) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// GET /api/tierlist/:id — cargar por share_id
router.get("/:id", (req, res) => {
  ensureTable();
  const row = webDB().prepare("SELECT * FROM tierlist_saves WHERE share_id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Tier list no encontrado" });
  res.json({
    ...row,
    tiers: JSON.parse(row.tiers),
    items: JSON.parse(row.items),
  });
});

// POST /api/tierlist — guardar nuevo
router.post("/", (req, res) => {
  ensureTable();
  const { titulo, juego, tiers, items } = req.body;
  if (!tiers || !items) return res.status(400).json({ error: "Faltan datos" });

  // Obtener usuario si hay token (opcional)
  let autor_id = null, autor_nombre = "Anónimo";
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      const jwt  = require("jsonwebtoken");
      const user = jwt.verify(token, process.env.JWT_SECRET);
      autor_id    = user.id;
      autor_nombre = user.username;
    } catch {}
  }

  let share_id, attempts = 0;
  while (attempts < 10) {
    share_id = genId();
    const exists = webDB().prepare("SELECT 1 FROM tierlist_saves WHERE share_id = ?").get(share_id);
    if (!exists) break;
    attempts++;
  }

  webDB().prepare(`
    INSERT INTO tierlist_saves (share_id, titulo, juego, tiers, items, autor_id, autor_nombre)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(share_id, titulo || "Mi Tier List", juego || null,
         JSON.stringify(tiers), JSON.stringify(items), autor_id, autor_nombre);

  res.json({ share_id, url: `/pages/tierlist/?tl=${share_id}` });
});

// PUT /api/tierlist/:id — actualizar (cualquiera puede crear una copia, o el autor editar)
router.put("/:id", (req, res) => {
  ensureTable();
  const { titulo, juego, tiers, items, fork } = req.body;
  if (!tiers || !items) return res.status(400).json({ error: "Faltan datos" });

  const existing = webDB().prepare("SELECT * FROM tierlist_saves WHERE share_id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "No encontrado" });

  // Si fork=true o el autor es diferente → crear copia nueva
  let autor_id = null, autor_nombre = "Anónimo";
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      const jwt  = require("jsonwebtoken");
      const user = jwt.verify(token, process.env.JWT_SECRET);
      autor_id    = user.id;
      autor_nombre = user.username;
    } catch {}
  }

  const esAutor = autor_id && autor_id === existing.autor_id;

  if (fork || !esAutor) {
    // Fork: crear nueva copia
    let share_id;
    do { share_id = genId(); }
    while (webDB().prepare("SELECT 1 FROM tierlist_saves WHERE share_id = ?").get(share_id));

    webDB().prepare(`
      INSERT INTO tierlist_saves (share_id, titulo, juego, tiers, items, autor_id, autor_nombre)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(share_id, titulo || existing.titulo, juego || existing.juego,
           JSON.stringify(tiers), JSON.stringify(items), autor_id, autor_nombre);

    return res.json({ share_id, url: `/pages/tierlist/?tl=${share_id}`, forked: true });
  }

  // Mismo autor: editar in-place
  webDB().prepare(`
    UPDATE tierlist_saves SET titulo=?, juego=?, tiers=?, items=?, updated_at=datetime('now')
    WHERE share_id=?
  `).run(titulo, juego || null, JSON.stringify(tiers), JSON.stringify(items), req.params.id);

  res.json({ share_id: req.params.id, url: `/pages/tierlist/?tl=${req.params.id}`, forked: false });
});

module.exports = router;
