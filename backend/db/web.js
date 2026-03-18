// Conexión READ-WRITE al DB web (blog, comentarios, ratings, push subs)
const Database = require("better-sqlite3");
const path = require("path");

const WEB_DB_PATH = process.env.WEB_DB_PATH || "/home/sunshinesquad/sunshinesquad_web/web.db";

let _db = null;
function webDB() {
  if (!_db) {
    _db = new Database(WEB_DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT UNIQUE NOT NULL,
      titulo      TEXT NOT NULL,
      contenido   TEXT NOT NULL,
      resumen     TEXT,
      juego       TEXT,
      autor_id    TEXT NOT NULL,
      autor_nombre TEXT NOT NULL,
      publicado   INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blog_comentarios (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id     INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
      autor_id    TEXT NOT NULL,
      autor_nombre TEXT NOT NULL,
      autor_avatar TEXT,
      contenido   TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blog_ratings (
      post_id     INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL,
      estrellas   INTEGER NOT NULL CHECK(estrellas BETWEEN 1 AND 5),
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT,
      endpoint    TEXT UNIQUE NOT NULL,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS guides (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT UNIQUE NOT NULL,
      juego       TEXT NOT NULL,
      titulo      TEXT NOT NULL,
      contenido   TEXT NOT NULL,
      autor_id    TEXT NOT NULL,
      autor_nombre TEXT NOT NULL,
      publicado   INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_games (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre      TEXT NOT NULL,
      imagen      TEXT DEFAULT '',
      descripcion TEXT DEFAULT '',
      guild       INTEGER DEFAULT 0,
      serie       INTEGER DEFAULT 0,
      sss         INTEGER DEFAULT 0,
      servidor    TEXT DEFAULT '',
      url         TEXT DEFAULT '',
      activo      INTEGER DEFAULT 1,
      orden       INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_schedule (
      id          TEXT PRIMARY KEY,
      fecha       TEXT,
      hora        TEXT NOT NULL,
      juego       TEXT NOT NULL,
      evento      TEXT NOT NULL,
      duracion    REAL DEFAULT 1,
      timezone    TEXT DEFAULT 'UTC',
      url         TEXT DEFAULT '#',
      activo      INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_activities (
      event_id          TEXT PRIMARY KEY,
      nombre            TEXT DEFAULT '',
      juego             TEXT DEFAULT '',
      descripcion       TEXT DEFAULT '',
      nivel_minimo      TEXT DEFAULT '',
      clases            TEXT DEFAULT '[]',
      items_requeridos  TEXT DEFAULT '[]',
      consumibles       TEXT DEFAULT '[]',
      link_info         TEXT DEFAULT '#',
      link_registro     TEXT DEFAULT '#',
      updated_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_streams (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      name    TEXT NOT NULL,
      channel TEXT UNIQUE NOT NULL,
      activo  INTEGER DEFAULT 1,
      orden   INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS discord_users (
      discord_id   TEXT PRIMARY KEY,
      username     TEXT NOT NULL,
      avatar       TEXT,
      last_seen    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_preferences (
      user_id      TEXT PRIMARY KEY,
      pref_blog    INTEGER DEFAULT 1,
      pref_event   INTEGER DEFAULT 1,
      pref_birthday INTEGER DEFAULT 1,
      pref_tierlist INTEGER DEFAULT 0,
      updated_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      sent_by      TEXT,
      type         TEXT DEFAULT 'manual',
      title        TEXT,
      body         TEXT,
      url          TEXT,
      target       TEXT DEFAULT 'all',
      sent_count   INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_event_rsvp (
      event_id   TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      username   TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      filename        TEXT NOT NULL,
      originalname    TEXT NOT NULL,
      mimetype        TEXT NOT NULL,
      size            INTEGER NOT NULL,
      categoria       TEXT DEFAULT 'general',
      uploader_id     TEXT,
      uploader_nombre TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  seedSiteData(db);
}

function seedSiteData(db) {
  // Solo siembra si las tablas están vacías
  const gamesCount = db.prepare("SELECT COUNT(*) as c FROM site_games").get().c;
  if (gamesCount === 0) {
    const ins = db.prepare(`INSERT INTO site_games (nombre,imagen,descripcion,guild,serie,sss,servidor,url,activo,orden) VALUES (?,?,?,?,?,?,?,?,1,?)`);
    const seed = db.transaction(() => {
      const games = [
        ["Ragnarok Online","assets/images/games/ragnarok.jpg","Servidor Privado uaRO · Pre-Renewal · Clan activo",1,0,0,"uaRO · Pre-Renewal","pages/juegos/ragnarok/ragnarok.html",0],
        ["World of Warcraft","assets/images/games/wow.jpg","Servidor Oficial US · Burning Crusade 20th · Clan activo",1,0,0,"DreamScythe · BC 20th","pages/juegos/wow/wow.html",1],
        ["Lineage 2","assets/images/games/lineage2.jpg","Servidor Privado Reborn Origins · High Five · Clan activo",1,0,0,"Reborn Origins · High Five","pages/juegos/lineage2/lineage2.html",2],
        ["Brawl Stars","assets/images/games/brawlstars.jpg","Servidor Oficial · Club activo",1,0,0,"Oficial","pages/juegos/brawlstars/brawlstars.html",3],
        ["Throne and Liberty","assets/images/games/throneandliberty.jpg","Servidor Oficial US-East Ivory · Guild activo",1,0,0,"US-East Ivory","pages/juegos/throneandliberty/throneandliberty.html",4],
        ["Core Keeper","assets/images/games/corekeeper.jpg","Servidor propio de la comunidad · Próximamente",0,0,0,"Servidor comunidad","pages/juegos/corekeeper/corekeeper.html",5],
        ["Left 4 Dead 2","assets/images/games/l4d2.jpg","Serie en stream · Supervivencia cooperativa",0,1,0,"Oficial","pages/juegos/l4d2/l4d2.html",6],
        ["Overcooked 2","assets/images/games/overcooked2.jpg","Jugamos por diversión · Caos culinario",0,0,0,"Oficial","pages/juegos/overcooked2/overcooked2.html",7],
        ["Project Zomboid","assets/images/games/zomboid.jpg","Jugamos por diversión · Supervivencia zombie",0,0,0,"Oficial","pages/juegos/zomboid/zomboid.html",8],
        ["Minecraft","assets/images/games/minecraft.jpg","Jugamos por diversión · Construcción sin límites",0,0,0,"Oficial","pages/juegos/minecraft/minecraft.html",9],
        ["Dota 2","assets/images/games/dota2.jpg","Jugamos por diversión · MOBA competitivo",0,0,0,"Oficial","pages/juegos/dota2/dota2.html",10],
        ["League of Legends","assets/images/games/lol.jpg","Jugamos por diversión · MOBA clásico",0,0,0,"Oficial","pages/juegos/lol/lol.html",11],
        ["Smite 2","assets/images/games/smite2.jpg","Jugamos por diversión · MOBA en tercera persona",0,0,0,"Oficial","pages/juegos/smite2/smite2.html",12],
      ];
      games.forEach(g => ins.run(...g));
    });
    seed();
  }

  const schedCount = db.prepare("SELECT COUNT(*) as c FROM site_schedule").get().c;
  if (schedCount === 0) {
    const insEv  = db.prepare(`INSERT INTO site_schedule (id,fecha,hora,juego,evento,duracion,timezone,url,activo) VALUES (?,?,?,?,?,?,?,?,1)`);
    const insAct = db.prepare(`INSERT INTO site_activities (event_id,nombre,juego,descripcion,nivel_minimo,clases,items_requeridos,consumibles,link_info,link_registro) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const seed = db.transaction(() => {
      const eventos = [
        ["htf-ragnarok","2026-03-02","19:00","Ragnarok Online","Horror Toy Factory",2,"UTC","#"],
        ["dq-wow","2026-03-03","16:00","World of Warcraft","Dungeons y Quests",4,"America/Los_Angeles","#"],
        ["leveo-ogh","2026-03-07","16:00","Ragnarok Online","Leveo y OGH",2,"UTC","#"],
        ["et-ragnarok","2026-03-08","16:00","Ragnarok Online","Endless Tower",3,"UTC","#"],
        ["raid-wow","2026-03-09","20:00","World of Warcraft","Raid Semanal",3,"America/Los_Angeles","#"],
        ["woe-ragnarok","2026-03-11","20:00","Ragnarok Online","War of Emperium",2,"UTC","#"],
        ["siege-l2","2026-03-14","21:00","Lineage 2","Siege semanal",2,"UTC","#"],
        ["brawl-club","2026-03-15","18:00","Brawl Stars","Club League",2,"America/Los_Angeles","#"],
        ["tnl-siege","2026-03-15","21:00","Throne and Liberty","Castle Siege",2,"America/New_York","#"],
      ];
      eventos.forEach(e => insEv.run(...e));

      const actividades = [
        ["htf-ragnarok","Horror Toy Factory","Ragnarok Online","Instancia de Halloween ambientada en una fábrica de juguetes embrujada. Requiere coordinación de grupo para superar los jefes internos y obtener recompensas exclusivas.","99/70",'["Todas las clases Trans"]','["Yggdrasil Berry x10","Token of Siegfried x5"]','["Potion Pitcher","Converters según clase"]',"https://wiki.uaro.net/site/","#"],
        ["dq-wow","Dungeons y Quests","World of Warcraft","Sesión de mazmorras y quests del contenido de Burning Crusade. Ideal para avanzar en equipo, completar cadenas de misiones y farmear objetos de raid.","70",'["Todas"]','["Ninguno"]','["Flasks","Food Buffs"]',"#","#"],
        ["leveo-ogh","Leveo y Old Glast Heim","Ragnarok Online","Sesión de leveling en zonas eficientes y recorrido por Old Glast Heim. Perfecta para subir nivel rápido y obtener drops valiosos del campo.","80/50",'["Todas"]','["Ninguno obligatorio"]','["Fly Wing","Blue Potion"]',"https://wiki.uaro.net/site/","#"],
        ["et-ragnarok","Endless Tower","Ragnarok Online","Torre de 100 pisos con MVPs y mobs desafiantes en cada nivel. Requiere un equipo coordinado, buena preparación y conocimiento de las mecánicas de los jefes.","99/70",'["Healer obligatorio","Tank recomendado"]','["Token of Siegfried x10","Yggdrasil Berry x15"]','["Converters","Potions","Fly Wing"]',"https://wiki.uaro.net/site/","#"],
      ];
      actividades.forEach(a => insAct.run(...a));
    });
    seed();
  }

  const streamsCount = db.prepare("SELECT COUNT(*) as c FROM site_streams").get().c;
  if (streamsCount === 0) {
    const ins = db.prepare("INSERT INTO site_streams (name, channel, activo, orden) VALUES (?,?,1,?)");
    const seed = db.transaction(() => {
      [["GG4ALL","gg4alltv",0],["IlloJuan","illojuan",1],["ElXokas","elxokas",2],["Rubius","rubius",3],["Carola","carola",4]]
        .forEach(s => ins.run(...s));
    });
    seed();
  }
}

module.exports = { webDB };
