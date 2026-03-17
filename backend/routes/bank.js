const { Router } = require("express");
const { botDB } = require("../db/bot");
const router = Router();

function resolveGameId(db, gameKey) {
  if (!gameKey) return null;
  const game = db.prepare(
    "SELECT id FROM game_info WHERE command_key = ? AND is_active = 1 LIMIT 1"
  ).get(gameKey);
  return game?.id ?? null;
}

// GET /api/bank?game=ro
// Devuelve los items del banco, agrupados por juego si no se especifica game
router.get("/", (req, res) => {
  try {
    const db      = botDB();
    const gameKey = req.query.game || null;

    let items;
    if (gameKey) {
      const gameId = resolveGameId(db, gameKey);
      if (!gameId) return res.json({ items: [], game: null });

      const game = db.prepare("SELECT id, name, command_key, COALESCE(emoji,'🎮') as emoji FROM game_info WHERE id=?").get(gameId);
      items = db.prepare(`
        SELECT bi.id, bi.item_name, bi.item_code,
               COALESCE(bi.item_emoji,'📦') as item_emoji,
               bi.category, bi.quantity, bi.updated_at,
               gi.name as game_name, gi.command_key, gi.id as game_id
        FROM bank_items bi
        JOIN game_info gi ON gi.id = bi.game_id
        WHERE bi.game_id = ?
        ORDER BY bi.category, bi.item_name
      `).all(gameId);

      return res.json({ game, items });
    }

    // All games
    items = db.prepare(`
      SELECT bi.id, bi.item_name, bi.item_code,
             COALESCE(bi.item_emoji,'📦') as item_emoji,
             bi.category, bi.quantity, bi.updated_at,
             gi.name as game_name, gi.command_key, gi.id as game_id,
             COALESCE(gi.emoji,'🎮') as game_emoji
      FROM bank_items bi
      JOIN game_info gi ON gi.id = bi.game_id AND gi.is_active = 1
      ORDER BY gi.name, bi.category, bi.item_name
    `).all();

    res.json({ game: null, items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/bank/transactions?game=ro&limit=20
router.get("/transactions", (req, res) => {
  try {
    const db      = botDB();
    const gameKey = req.query.game || null;
    const limit   = Math.min(parseInt(req.query.limit) || 20, 100);

    let rows;
    if (gameKey) {
      const gameId = resolveGameId(db, gameKey);
      if (!gameId) return res.json([]);
      rows = db.prepare(`
        SELECT bit.id, bit.item_name, bit.item_code, bit.qty_change,
               bit.tx_type, bit.note, bit.admin_id, bit.created_at,
               gi.name as game_name, gi.command_key
        FROM bank_item_transactions bit
        JOIN game_info gi ON gi.id = bit.game_id
        WHERE bit.game_id = ?
        ORDER BY bit.created_at DESC
        LIMIT ?
      `).all(gameId, limit);
    } else {
      rows = db.prepare(`
        SELECT bit.id, bit.item_name, bit.item_code, bit.qty_change,
               bit.tx_type, bit.note, bit.admin_id, bit.created_at,
               gi.name as game_name, gi.command_key
        FROM bank_item_transactions bit
        JOIN game_info gi ON gi.id = bit.game_id AND gi.is_active = 1
        ORDER BY bit.created_at DESC
        LIMIT ?
      `).all(limit);
    }

    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
