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
  `);
}

module.exports = { webDB };
