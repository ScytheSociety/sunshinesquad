const express  = require("express");
const router   = express.Router();
const { webDB } = require("../db/web");
const { requireAuth, requireRole } = require("../middleware/auth");
const { sendPush } = require("../utils/pushHelper");

const POR_PAGINA = 10;

// Asegura que la columna portada_url exista (migración no destructiva)
try {
  webDB().exec("ALTER TABLE blog_posts ADD COLUMN portada_url TEXT");
} catch (_) { /* columna ya existe */ }

// GET /api/blog?page=1&juego=ragnarok
router.get("/", (req, res) => {
  const db    = webDB();
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const juego = req.query.juego || null;
  const offset = (page - 1) * POR_PAGINA;

  const where = juego ? "WHERE publicado=1 AND juego=?" : "WHERE publicado=1";
  const args  = juego ? [juego, POR_PAGINA, offset] : [POR_PAGINA, offset];

  const total = db.prepare(`SELECT COUNT(*) as n FROM blog_posts ${where}`).get(...(juego ? [juego] : [])).n;
  const posts = db.prepare(`
    SELECT id, slug, titulo, resumen, juego, autor_nombre, portada_url, created_at,
           (SELECT ROUND(AVG(estrellas),1) FROM blog_ratings WHERE post_id=blog_posts.id) AS rating,
           (SELECT COUNT(*) FROM blog_ratings WHERE post_id=blog_posts.id) AS votos
    FROM blog_posts ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...args);

  res.json({ posts, total, page, paginas: Math.ceil(total / POR_PAGINA) });
});

// GET /api/blog/:slug
router.get("/:slug", (req, res) => {
  const db   = webDB();
  const post = db.prepare("SELECT * FROM blog_posts WHERE slug=? AND publicado=1").get(req.params.slug);
  if (!post) return res.status(404).json({ error: "Post no encontrado" });

  const rating = db.prepare("SELECT ROUND(AVG(estrellas),1) AS avg, COUNT(*) AS votos FROM blog_ratings WHERE post_id=?").get(post.id);
  res.json({ ...post, rating: rating.avg, votos: rating.votos });
});

// GET /api/blog/:slug/comentarios?page=1
router.get("/:slug/comentarios", (req, res) => {
  const db   = webDB();
  const post = db.prepare("SELECT id FROM blog_posts WHERE slug=? AND publicado=1").get(req.params.slug);
  if (!post) return res.status(404).json({ error: "Post no encontrado" });

  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const offset = (page - 1) * POR_PAGINA;
  const total  = db.prepare("SELECT COUNT(*) as n FROM blog_comentarios WHERE post_id=?").get(post.id).n;
  const items  = db.prepare("SELECT * FROM blog_comentarios WHERE post_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?").all(post.id, POR_PAGINA, offset);

  res.json({ comentarios: items, total, page, paginas: Math.ceil(total / POR_PAGINA) });
});

// POST /api/blog/:slug/comentarios  → requiere autenticación
router.post("/:slug/comentarios", requireAuth, (req, res) => {
  const db   = webDB();
  const post = db.prepare("SELECT id FROM blog_posts WHERE slug=? AND publicado=1").get(req.params.slug);
  if (!post) return res.status(404).json({ error: "Post no encontrado" });

  const { contenido } = req.body;
  if (!contenido?.trim()) return res.status(400).json({ error: "Contenido requerido" });

  db.prepare(`
    INSERT INTO blog_comentarios (post_id, autor_id, autor_nombre, autor_avatar, contenido)
    VALUES (?, ?, ?, ?, ?)
  `).run(post.id, req.user.id, req.user.username, req.user.avatar, contenido.trim());

  res.json({ ok: true });
});

// POST /api/blog/:slug/rating  → requiere autenticación
router.post("/:slug/rating", requireAuth, (req, res) => {
  const db   = webDB();
  const post = db.prepare("SELECT id FROM blog_posts WHERE slug=? AND publicado=1").get(req.params.slug);
  if (!post) return res.status(404).json({ error: "Post no encontrado" });

  const estrellas = parseInt(req.body.estrellas);
  if (estrellas < 1 || estrellas > 5) return res.status(400).json({ error: "Rating inválido (1-5)" });

  db.prepare(`
    INSERT INTO blog_ratings (post_id, user_id, estrellas) VALUES (?, ?, ?)
    ON CONFLICT(post_id, user_id) DO UPDATE SET estrellas=excluded.estrellas
  `).run(post.id, req.user.id, estrellas);

  const rating = db.prepare("SELECT ROUND(AVG(estrellas),1) AS avg, COUNT(*) AS votos FROM blog_ratings WHERE post_id=?").get(post.id);
  res.json({ rating: rating.avg, votos: rating.votos });
});

// ── Admin/Editor routes ─────────────────────────────────────────────

// POST /api/blog  → crear post (editor o superior)
router.post("/", requireRole("editor"), (req, res) => {
  const db = webDB();
  const { slug, titulo, contenido, resumen, juego, portada_url, publicado } = req.body;
  if (!slug || !titulo || !contenido) return res.status(400).json({ error: "Faltan campos requeridos" });

  try {
    const info = db.prepare(`
      INSERT INTO blog_posts (slug, titulo, contenido, resumen, juego, portada_url, autor_id, autor_nombre, publicado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(slug, titulo, contenido, resumen || "", juego || null, portada_url || null, req.user.id, req.user.username, publicado ? 1 : 0);

    if (publicado) {
      sendPush({
        type: "blog", title: `📝 Nuevo post: ${titulo}`,
        body: resumen || `Por ${req.user.username}`,
        url:  `https://sunshinesquad.es/pages/blog/post.html?slug=${slug}`,
        sentBy: req.user.id,
      }).catch(() => {});
    }
    res.json({ id: info.lastInsertRowid });
  } catch (err) {
    if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "El slug ya existe" });
    throw err;
  }
});

// PUT /api/blog/:slug  → editar post
router.put("/:slug", requireRole("editor"), (req, res) => {
  const db = webDB();
  const { titulo, contenido, resumen, juego, portada_url, publicado } = req.body;

  const before = db.prepare("SELECT publicado, titulo, resumen FROM blog_posts WHERE slug=?").get(req.params.slug);
  db.prepare(`
    UPDATE blog_posts SET titulo=?, contenido=?, resumen=?, juego=?, portada_url=?, publicado=?,
    updated_at=datetime('now') WHERE slug=?
  `).run(titulo, contenido, resumen, juego, portada_url || null, publicado ? 1 : 0, req.params.slug);

  // Send push only when transitioning from unpublished → published
  if (publicado && before && !before.publicado) {
    sendPush({
      type: "blog", title: `📝 Nuevo post: ${titulo || before.titulo}`,
      body: resumen || before.resumen || `Por ${req.user.username}`,
      url:  `https://sunshinesquad.es/pages/blog/post.html?slug=${req.params.slug}`,
      sentBy: req.user.id,
    }).catch(() => {});
  }
  res.json({ ok: true });
});

// DELETE /api/blog/:slug  → eliminar post (moderador o superior)
router.delete("/:slug", requireRole("moderador"), (req, res) => {
  const db = webDB();
  db.prepare("DELETE FROM blog_posts WHERE slug=?").run(req.params.slug);
  res.json({ ok: true });
});

module.exports = router;
