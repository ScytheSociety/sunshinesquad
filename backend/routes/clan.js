const express  = require("express");
const router   = express.Router();
const { botDB } = require("../db/bot");
const { webDB } = require("../db/web");

// GET /api/clan/:game
// Devuelve los miembros del clan para un juego específico
// Busca en game_info por nombre parcial (case-insensitive)
router.get("/:game", (req, res) => {
  try {
    const db      = botDB();
    const gameKey = req.params.game.toLowerCase();

    // Mapeo de game key → posibles nombres en la DB del bot
    const GAME_NAMES = {
      ragnarok:        ["ragnarok", "ro"],
      wow:             ["world of warcraft", "wow"],
      lineage2:        ["lineage", "l2"],
      brawlstars:      ["brawl"],
      throneandliberty:["throne", "liberty", "tl"],
    };

    const keywords = GAME_NAMES[gameKey] || [gameKey];

    // Buscar game_id(s) que coincidan con alguna keyword
    const allGames = db.prepare("SELECT id, name FROM game_info").all();
    const matchIds = allGames
      .filter(g => keywords.some(k => g.name.toLowerCase().includes(k)))
      .map(g => g.id);

    if (!matchIds.length) {
      return res.json([]);
    }

    const placeholders = matchIds.map(() => "?").join(",");

    const rows = db.prepare(`
      SELECT DISTINCT
        u.discord_user_id,
        u.display_name   AS username,
        COALESCE(pts.puntos, 0) AS puntos
      FROM (
        -- Usuarios con stats del juego
        SELECT ugs.user_id FROM user_game_stats ugs WHERE ugs.game_id IN (${placeholders})
        UNION
        -- Usuarios con personajes del juego (aunque no tengan stats)
        SELECT u2.id FROM characters c JOIN users u2 ON u2.discord_user_id = c.discord_user_id
        WHERE c.game_id IN (${placeholders}) AND c.is_active = 1
      ) combined
      JOIN users u ON u.id = combined.user_id
      LEFT JOIN (
        SELECT user_id, SUM(points) as puntos FROM user_game_stats
        WHERE game_id IN (${placeholders}) GROUP BY user_id
      ) pts ON pts.user_id = u.id
      ORDER BY puntos DESC
      LIMIT 50
    `).all(...matchIds, ...matchIds, ...matchIds);

    const result = rows.map(r => {
      const characters = db.prepare(`
        SELECT c.character_name, c.level, c.is_main, c.points,
               COALESCE(cl.name,'') as class_name, COALESCE(cl.emoji,'') as class_emoji,
               COALESCE(ro.name,'') as role_name, COALESCE(ro.emoji,'') as role_emoji
        FROM characters c
        LEFT JOIN classes cl ON cl.id = c.class_id
        LEFT JOIN roles ro   ON ro.id = c.role_id
        WHERE c.discord_user_id = ? AND c.game_id IN (${placeholders}) AND c.is_active = 1
        ORDER BY c.is_main DESC, c.points DESC
        LIMIT 5
      `).all(r.discord_user_id, ...matchIds);
      return {
        discord_id:    r.discord_user_id,
        username:      r.username,
        puntos:        r.puntos,
        avatar_url:    null,         // se rellena abajo en batch
        main_character: characters[0] || null,
        characters,
      };
    });

    // Enriquecer avatares en batch desde discord_users (web DB)
    const discordIds = result.map(r => r.discord_id);
    if (discordIds.length) {
      const web = webDB();
      const ph  = discordIds.map(() => "?").join(",");
      web.prepare(`SELECT discord_id, avatar FROM discord_users WHERE discord_id IN (${ph})`)
        .all(...discordIds)
        .forEach(d => {
          const member = result.find(r => r.discord_id === d.discord_id);
          if (member) member.avatar_url = d.avatar || null;
        });
    }

    // Fallback: avatar por defecto de Discord si no hay cacheo
    result.forEach(r => {
      if (!r.avatar_url) {
        try {
          r.avatar_url = `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(r.discord_id) % 6n)}.png`;
        } catch { r.avatar_url = "https://cdn.discordapp.com/embed/avatars/0.png"; }
      }
    });

    res.json(result);
  } catch (err) {
    console.error("clan:", err);
    res.status(500).json({ error: "Error al obtener miembros" });
  }
});

module.exports = router;
