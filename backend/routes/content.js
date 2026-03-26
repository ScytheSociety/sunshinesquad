const express  = require("express");
const router   = express.Router();
const { webDB } = require("../db/web");
const { requireAuth, requireRole } = require("../middleware/auth");

const POR_PAGINA = 12;

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function canEdit(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return false;
  try {
    const jwt     = require("jsonwebtoken");
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    return ["editor","moderador","admin"].includes(payload.role);
  } catch { return false; }
}

// GET /api/content?game_key=ragnarok&tipo=guia&q=&page=1
router.get("/", (req, res) => {
  try {
    const db       = webDB();
    const gameKey  = req.query.game_key || null;
    const tipo     = req.query.tipo     || null;
    const q        = req.query.q?.trim() || null;
    const page     = Math.max(1, parseInt(req.query.page) || 1);
    const isEditor = canEdit(req);
    const offset   = (page - 1) * POR_PAGINA;

    const conditions = isEditor ? [] : ["publicado=1"];
    const args = [];
    if (gameKey) { conditions.push("cp.game_key=?"); args.push(gameKey); }
    if (tipo)    { conditions.push("cp.tipo=?");     args.push(tipo); }
    if (q) {
      conditions.push("(cp.titulo LIKE ? OR cp.resumen LIKE ? OR cp.autor_nombre LIKE ?)");
      const like = `%${q}%`;
      args.push(like, like, like);
    }
    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    const total = db.prepare(`SELECT COUNT(*) as n FROM content_posts cp ${where}`).get(...args).n;
    const posts = db.prepare(`
      SELECT cp.id, cp.tipo, cp.game_key, cp.slug, cp.titulo, cp.resumen, cp.portada,
             cp.autor_id, cp.autor_nombre, cp.autor_avatar, cp.publicado, cp.created_at,
             du.avatar AS autor_avatar_cached,
             ROUND((SELECT AVG(estrellas) FROM content_ratings WHERE post_id=cp.id),1) AS rating,
             (SELECT COUNT(*) FROM content_ratings WHERE post_id=cp.id) AS votos
      FROM content_posts cp
      LEFT JOIN discord_users du ON du.discord_id = cp.autor_id
      ${where}
      ORDER BY cp.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...args, POR_PAGINA, offset);

    res.json({ posts, total, page, paginas: Math.ceil(total / POR_PAGINA) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/content — crear post (editor+)
router.post("/", requireRole("editor"), (req, res) => {
  try {
    const db = webDB();
    const { tipo, game_key, titulo, resumen, portada, contenido, publicado } = req.body;
    if (!tipo || !game_key || !titulo) return res.status(400).json({ error: "tipo, game_key y titulo son requeridos" });

    // Generar slug único
    let slug = slugify(titulo);
    const exists = db.prepare("SELECT id FROM content_posts WHERE slug=?").get(slug);
    if (exists) slug = `${slug}-${Date.now().toString(36)}`;

    const avatar = req.user.avatar || "";
    const r = db.prepare(`
      INSERT INTO content_posts (tipo,game_key,slug,titulo,resumen,portada,contenido,autor_id,autor_nombre,autor_avatar,publicado)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(tipo, game_key, slug, titulo, resumen||"", portada||"", contenido||"",
           req.user.id, req.user.username, avatar, publicado ? 1 : 0);

    res.status(201).json({ id: r.lastInsertRowid, slug });
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "El slug ya existe" });
    res.status(500).json({ error: e.message });
  }
});

// GET /api/content/:game_key/:slug/comentarios
router.get("/:game_key/:slug/comentarios", (req, res) => {
  try {
    const db   = webDB();
    const post = db.prepare("SELECT id FROM content_posts WHERE game_key=? AND slug=? AND publicado=1")
                   .get(req.params.game_key, req.params.slug);
    if (!post) return res.status(404).json({ error: "Post no encontrado" });

    const page   = Math.max(1, parseInt(req.query.page) || 1);
    const offset = (page - 1) * POR_PAGINA;
    const total  = db.prepare("SELECT COUNT(*) as n FROM content_comentarios WHERE post_id=?").get(post.id).n;
    const items  = db.prepare("SELECT * FROM content_comentarios WHERE post_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?")
                     .all(post.id, POR_PAGINA, offset);
    res.json({ comentarios: items, total, page, paginas: Math.ceil(total / POR_PAGINA) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/content/:game_key/:slug/comentarios (requireAuth)
router.post("/:game_key/:slug/comentarios", requireAuth, (req, res) => {
  try {
    const db   = webDB();
    const post = db.prepare("SELECT id FROM content_posts WHERE game_key=? AND slug=? AND publicado=1")
                   .get(req.params.game_key, req.params.slug);
    if (!post) return res.status(404).json({ error: "Post no encontrado" });

    const { contenido } = req.body;
    if (!contenido?.trim()) return res.status(400).json({ error: "Contenido requerido" });

    db.prepare(`INSERT INTO content_comentarios (post_id,autor_id,autor_nombre,autor_avatar,contenido)
      VALUES (?,?,?,?,?)`)
      .run(post.id, req.user.id, req.user.username, req.user.avatar||"", contenido.trim());
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/content/:game_key/:slug/rating (requireAuth)
router.post("/:game_key/:slug/rating", requireAuth, (req, res) => {
  try {
    const db   = webDB();
    const post = db.prepare("SELECT id FROM content_posts WHERE game_key=? AND slug=? AND publicado=1")
                   .get(req.params.game_key, req.params.slug);
    if (!post) return res.status(404).json({ error: "Post no encontrado" });

    const estrellas = parseInt(req.body.estrellas);
    if (estrellas < 1 || estrellas > 5) return res.status(400).json({ error: "Rating inválido (1-5)" });

    db.prepare(`INSERT INTO content_ratings (post_id,user_id,estrellas) VALUES (?,?,?)
      ON CONFLICT(post_id,user_id) DO UPDATE SET estrellas=excluded.estrellas`)
      .run(post.id, req.user.id, estrellas);

    const rating = db.prepare("SELECT ROUND(AVG(estrellas),1) AS avg, COUNT(*) AS votos FROM content_ratings WHERE post_id=?").get(post.id);
    res.json({ rating: rating.avg, votos: rating.votos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/content/:game_key/:slug — post individual
router.get("/:game_key/:slug", (req, res) => {
  try {
    const db = webDB();
    const isEditor = canEdit(req);
    const post = db.prepare(
      isEditor
        ? "SELECT * FROM content_posts WHERE game_key=? AND slug=?"
        : "SELECT * FROM content_posts WHERE game_key=? AND slug=? AND publicado=1"
    ).get(req.params.game_key, req.params.slug);
    if (!post) return res.status(404).json({ error: "Post no encontrado" });

    const rating = db.prepare("SELECT ROUND(AVG(estrellas),1) AS avg, COUNT(*) AS votos FROM content_ratings WHERE post_id=?").get(post.id);
    res.json({ ...post, rating: rating.avg, votos: rating.votos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/content/:id — editar (editor+)
router.put("/:id", requireRole("editor"), (req, res) => {
  try {
    const db = webDB();
    const { titulo, resumen, portada, contenido, publicado } = req.body;
    const r = db.prepare(`
      UPDATE content_posts SET titulo=?,resumen=?,portada=?,contenido=?,publicado=?,
      updated_at=datetime('now') WHERE id=?
    `).run(titulo||"", resumen||"", portada||"", contenido||"", publicado?1:0, req.params.id);
    if (!r.changes) return res.status(404).json({ error: "Post no encontrado" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/content/:id — eliminar (moderador+)
router.delete("/:id", requireRole("moderador"), (req, res) => {
  try {
    const r = webDB().prepare("DELETE FROM content_posts WHERE id=?").run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: "Post no encontrado" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Sections CRUD (/api/content/sections) ───────────────────────────

// GET /api/content/sections?game_key=X — list sections for a game
router.get("/sections", (req, res) => {
  try {
    const { game_key } = req.query;
    if (!game_key) return res.status(400).json({ error: "game_key requerido" });
    const db = webDB();

    // Auto-seed defaults if this game has no sections yet
    const count = db.prepare("SELECT COUNT(*) as n FROM content_sections WHERE game_key=?").get(game_key).n;
    if (count === 0) {
      db.prepare("INSERT OR IGNORE INTO content_sections (game_key,tipo,label,emoji,orden) VALUES (?,?,?,?,?)")
        .run(game_key, "guia",  "Guías",  "📖", 0);
      db.prepare("INSERT OR IGNORE INTO content_sections (game_key,tipo,label,emoji,orden) VALUES (?,?,?,?,?)")
        .run(game_key, "build", "Builds", "🔧", 1);
    }

    const sections = db.prepare(
      "SELECT * FROM content_sections WHERE game_key=? ORDER BY orden ASC, id ASC"
    ).all(game_key);
    res.json(sections);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/content/sections — create section (editor+)
router.post("/sections", requireRole("editor"), (req, res) => {
  try {
    const db = webDB();
    const { game_key, tipo, label, emoji } = req.body;
    if (!game_key || !tipo || !label) return res.status(400).json({ error: "game_key, tipo y label requeridos" });

    const maxOrden = db.prepare("SELECT COALESCE(MAX(orden),0) as m FROM content_sections WHERE game_key=?").get(game_key).m;
    const r = db.prepare(
      "INSERT INTO content_sections (game_key,tipo,label,emoji,orden) VALUES (?,?,?,?,?)"
    ).run(game_key, tipo.toLowerCase().replace(/\s+/g,"-"), label, emoji||"", maxOrden + 1);

    res.status(201).json(db.prepare("SELECT * FROM content_sections WHERE id=?").get(r.lastInsertRowid));
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "Ya existe una sección con ese tipo para este juego" });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/content/sections/:id — edit section (editor+)
router.put("/sections/:id", requireRole("editor"), (req, res) => {
  try {
    const db = webDB();
    const { label, emoji } = req.body;
    if (!label) return res.status(400).json({ error: "label requerido" });
    const r = db.prepare("UPDATE content_sections SET label=?,emoji=? WHERE id=?")
      .run(label, emoji||"", req.params.id);
    if (!r.changes) return res.status(404).json({ error: "Sección no encontrada" });
    res.json(db.prepare("SELECT * FROM content_sections WHERE id=?").get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/content/sections/:id — delete section + its posts (admin)
router.delete("/sections/:id", requireRole("admin"), (req, res) => {
  try {
    const db  = webDB();
    const sec = db.prepare("SELECT * FROM content_sections WHERE id=?").get(req.params.id);
    if (!sec) return res.status(404).json({ error: "Sección no encontrada" });

    // Delete all posts in this section first (cascade not automatic without FK here)
    db.prepare("DELETE FROM content_posts WHERE game_key=? AND tipo=?").run(sec.game_key, sec.tipo);
    db.prepare("DELETE FROM content_sections WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
