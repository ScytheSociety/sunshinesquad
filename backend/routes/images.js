const { Router } = require("express");
const path    = require("path");
const fs      = require("fs");
const crypto  = require("crypto");
const multer  = require("multer");
const { requireRole } = require("../middleware/auth");
const { webDB } = require("../db/web");

const UPLOADS_DIR = process.env.UPLOADS_DIR || "/home/sunshinesquad/uploads";
const CATEGORIAS  = ["general", "games", "blog", "banner", "avatar"];
const MAX_SIZE    = 5 * 1024 * 1024; // 5 MB

// Asegurar que el directorio existe
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "");
    const name = crypto.randomBytes(10).toString("hex") + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Solo se aceptan imágenes (jpg, png, webp, gif)"));
  },
});

const router = Router();

// ── Servir archivos (público) ─────────────────────────────────────────────
router.get("/file/:filename", (req, res) => {
  const safe = path.basename(req.params.filename); // previene path traversal
  const filepath = path.join(UPLOADS_DIR, safe);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: "Archivo no encontrado" });
  res.sendFile(filepath);
});

// ── Listar imágenes (editor+) ─────────────────────────────────────────────
router.get("/", requireRole("editor"), (req, res) => {
  try {
    const categoria = req.query.categoria || null;
    const query = categoria
      ? "SELECT * FROM uploads WHERE categoria=? ORDER BY created_at DESC"
      : "SELECT * FROM uploads ORDER BY created_at DESC";
    const images = webDB().prepare(query).all(...(categoria ? [categoria] : []));
    res.json(images);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Subir imagen (editor+) ────────────────────────────────────────────────
router.post("/upload", requireRole("editor"), (req, res) => {
  upload.single("imagen")(req, res, err => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Imagen demasiado grande (máx 5 MB)" : err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" });

    const categoria = CATEGORIAS.includes(req.body.categoria) ? req.body.categoria : "general";
    try {
      const r = webDB().prepare(
        `INSERT INTO uploads (filename, originalname, mimetype, size, categoria, uploader_id, uploader_nombre)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(req.file.filename, req.file.originalname, req.file.mimetype, req.file.size,
            categoria, req.user.id, req.user.username);

      res.status(201).json({
        id:         r.lastInsertRowid,
        filename:   req.file.filename,
        url:        `/api/images/file/${req.file.filename}`,
        categoria,
        size:       req.file.size,
        originalname: req.file.originalname,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

// ── Eliminar imagen (editor+) ─────────────────────────────────────────────
router.delete("/:filename", requireRole("editor"), (req, res) => {
  try {
    const safe = path.basename(req.params.filename);
    const row  = webDB().prepare("SELECT * FROM uploads WHERE filename=?").get(safe);
    if (!row) return res.status(404).json({ error: "No encontrado" });

    // Solo admin puede borrar imágenes de otros; editor solo las propias
    if (req.user.role !== "admin" && row.uploader_id !== req.user.id) {
      return res.status(403).json({ error: "Solo puedes eliminar tus propias imágenes" });
    }

    const filepath = path.join(UPLOADS_DIR, safe);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    webDB().prepare("DELETE FROM uploads WHERE filename=?").run(safe);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
