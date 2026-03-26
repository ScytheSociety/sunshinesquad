const { Router } = require("express");
const { requireRole } = require("../middleware/auth");
const { webDB } = require("../db/web");
const { botDB } = require("../db/bot");
const fs   = require("fs");
const path = require("path");

// Directorio raíz del site (fuente de verdad para generar páginas)
const SITE_DIR = process.env.SITE_DIR || "/home/sunshinesquad/sunshinesquad_site";

function slugifyKey(text) {
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

function generateGamePage(gameId, nombre, providedUrl) {
  // Derivar game_key desde la URL si se proporcionó, o desde el nombre
  let gameKey = providedUrl?.match(/juegos\/([^/]+)\//)?.[1] || slugifyKey(nombre);
  if (!gameKey) gameKey = `game${gameId}`;

  const tmplPath = path.join(SITE_DIR, "pages/juegos/ragnarok/ragnarok.html");
  if (!fs.existsSync(tmplPath)) return { ok: false, error: "Template no encontrado" };

  let html = fs.readFileSync(tmplPath, "utf8");
  // Sustituciones en el template
  html = html
    .replace("<title>Ragnarok Online · Sunshine Squad</title>", `<title>${nombre} · Sunshine Squad</title>`)
    .replace('<body data-game="ragnarok">', `<body data-game="${gameKey}">`)
    .replace("<h1>Ragnarok Online</h1>", `<h1>${nombre}</h1>`);

  // Crear directorio y escribir HTML
  const gameDir = path.join(SITE_DIR, "pages", "juegos", gameKey);
  fs.mkdirSync(gameDir, { recursive: true });
  fs.writeFileSync(path.join(gameDir, `${gameKey}.html`), html, "utf8");

  // Crear data/{gameKey}.json vacío
  const dataJson = JSON.stringify({
    juego_nombre:       nombre,
    timezone_servidor:  "UTC",
    descripcion:        "",
    servidor: { nombre: "", logo: "", descripcion: "", web: "", wiki: "", descarga: "", discord: "", info: [] },
    galeria:  [],
    videos:   [],
    guias:    [],
    builds:   [],
  }, null, 2);
  const dataPath = path.join(SITE_DIR, "data", `${gameKey}.json`);
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, dataJson, "utf8");
  }

  const pageUrl = `pages/juegos/${gameKey}/${gameKey}.html`;
  return { ok: true, gameKey, pageUrl };
}

const router = Router();

// Migrations for new site_games columns
(function migrate() {
  const cols = [
    "mostrar_en_carrusel INTEGER DEFAULT 1",
    "mostrar_en_juegos   INTEGER DEFAULT 1",
    "bot_command_key     TEXT",
  ];
  cols.forEach(col => {
    try { webDB().prepare(`ALTER TABLE site_games ADD COLUMN ${col}`).run(); } catch {}
  });
})();

// GET /api/games/bot-games — bot games available for linking (must be BEFORE /:id)
router.get("/bot-games", (_req, res) => {
  try {
    const list = botDB().prepare(
      "SELECT id, name, command_key, COALESCE(emoji,'🎮') as emoji FROM game_info WHERE is_active=1 ORDER BY name ASC"
    ).all();
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all (public)
router.get("/", (req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=300"); // 5 min
    const games = webDB().prepare("SELECT * FROM site_games ORDER BY orden ASC, id ASC").all();

    // Enriquecer con command_key, emoji, abbreviation desde el bot
    const botGames = botDB().prepare(
      "SELECT name, command_key, abbreviation, COALESCE(emoji,'🎮') as emoji, timezone FROM game_info WHERE is_active=1"
    ).all();
    const botByName = {};
    botGames.forEach(g => { botByName[g.name.toLowerCase()] = g; });

    // Obtener icon_url por game_key desde game_server_config
    const iconRows = (() => {
      try { return webDB().prepare("SELECT game_key, icon_url FROM game_server_config WHERE icon_url != ''").all(); }
      catch { return []; }
    })();
    const iconByKey = {};
    iconRows.forEach(r => { iconByKey[r.game_key] = r.icon_url; });

    const enriched = games.map(g => {
      const bot    = botByName[g.nombre.toLowerCase()];
      const urlKey = g.url?.match(/juegos\/([^/]+)\//)?.[1] || null;
      return {
        ...g,
        command_key:    bot?.command_key  || null,
        abbreviation:   bot?.abbreviation || null,
        emoji:          bot?.emoji        || "🎮",
        game_timezone:  bot?.timezone     || "UTC",
        in_bot:         !!bot,
        site_icon_url:  urlKey ? (iconByKey[urlKey] || null) : null,
      };
    });

    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET one (public)
router.get("/:id", (req, res) => {
  try {
    const game = webDB().prepare("SELECT * FROM site_games WHERE id=?").get(req.params.id);
    if (!game) return res.status(404).json({ error: "No encontrado" });
    res.json(game);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create (editor+)
router.post("/", requireRole("editor"), (req, res) => {
  try {
    const { nombre, imagen, descripcion, guild, serie, sss, servidor, url, activo, orden,
            bot_command_key, generate_page } = req.body;
    if (!nombre) return res.status(400).json({ error: "nombre requerido" });

    const db = webDB();
    const r  = db.prepare(
      `INSERT INTO site_games (nombre,imagen,descripcion,guild,serie,sss,servidor,url,activo,orden,bot_command_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(nombre, imagen||"", descripcion||"", guild?1:0, serie?1:0, sss?1:0,
          servidor||"", url||"", activo!==false?1:0, orden||0, bot_command_key||null);

    const newId = r.lastInsertRowid;
    let generated = null;

    if (generate_page) {
      try {
        const result = generateGamePage(newId, nombre, url);
        if (result.ok) {
          // Actualizar la url del juego recién creado con la generada
          db.prepare("UPDATE site_games SET url=? WHERE id=?").run(result.pageUrl, newId);
          generated = { gameKey: result.gameKey, pageUrl: result.pageUrl };
        }
      } catch (genErr) {
        console.error("generate_page error:", genErr.message);
      }
    }

    const game = db.prepare("SELECT * FROM site_games WHERE id=?").get(newId);
    res.status(201).json({ ...game, generated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update (editor+)
router.put("/:id", requireRole("editor"), (req, res) => {
  try {
    const { nombre, imagen, descripcion, guild, serie, sss, servidor, url, activo, orden,
            bot_command_key } = req.body;
    const r = webDB().prepare(
      `UPDATE site_games SET nombre=?,imagen=?,descripcion=?,guild=?,serie=?,sss=?,servidor=?,url=?,activo=?,orden=?,
       bot_command_key=?,updated_at=datetime('now')
       WHERE id=?`
    ).run(nombre, imagen||"", descripcion||"", guild?1:0, serie?1:0, sss?1:0,
          servidor||"", url||"", activo!==false?1:0, orden||0, bot_command_key||null,
          req.params.id);
    if (!r.changes) return res.status(404).json({ error: "No encontrado" });
    res.json(webDB().prepare("SELECT * FROM site_games WHERE id=?").get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE (admin only)
router.delete("/:id", requireRole("admin"), (req, res) => {
  try {
    const r = webDB().prepare("DELETE FROM site_games WHERE id=?").run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST reorder (editor+)
router.post("/reorder", requireRole("editor"), (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "ids debe ser array" });
    const upd = webDB().prepare("UPDATE site_games SET orden=? WHERE id=?");
    webDB().transaction(ids => ids.forEach((id, i) => upd.run(i, id)))(ids);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
