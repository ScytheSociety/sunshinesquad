// Conexión READ-ONLY al DB del bot Discord
const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = process.env.BOT_DB_PATH || "/home/sunshinesquad/sunshinesquad/data/bot.sqlite3";

let _db = null;
function botDB() {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  }
  return _db;
}

module.exports = { botDB };
