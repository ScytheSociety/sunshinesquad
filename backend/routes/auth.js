const express = require("express");
const router  = express.Router();
const jwt     = require("jsonwebtoken");
const { botDB } = require("../db/bot");

const DISCORD_API = "https://discord.com/api/v10";

// Mapea permission_level (TEXT o número) a rol web
function getRoleFromDB(discordId) {
  try {
    const db  = botDB();
    const perm = db.prepare(
      `SELECT permission_level FROM permissions WHERE discord_user_id = ? LIMIT 1`
    ).get(discordId);

    if (perm) {
      const lvl = perm.permission_level?.toString().toLowerCase().trim();
      if (["admin","4"].includes(lvl) || parseInt(lvl) >= 4)     return "admin";
      if (["moderador","moderator","mod","3"].includes(lvl) || parseInt(lvl) >= 3) return "moderador";
      if (["editor","2"].includes(lvl) || parseInt(lvl) >= 2)    return "editor";
    }

    // ¿Tiene algún registro en el bot? → miembro
    const esUsuario = db.prepare(
      `SELECT 1 FROM users WHERE discord_user_id = ? LIMIT 1`
    ).get(discordId);
    if (esUsuario) return "miembro";

  } catch(e) {
    console.error("getRoleFromDB:", e.message);
  }
  return "visitante";
}

// GET /api/auth/discord
router.get("/discord", (req, res) => {
  const params = new URLSearchParams({
    client_id:     process.env.DISCORD_CLIENT_ID,
    redirect_uri:  process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope:         "identify",
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

// GET /api/auth/callback
router.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Código faltante");

  try {
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type:    "authorization_code",
        code,
        redirect_uri:  process.env.DISCORD_REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error_description || "OAuth error");

    const userRes     = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    const role   = getRoleFromDB(discordUser.id);
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(discordUser.id) % 6n)}.png`;

    // Cachear datos de Discord para perfiles web
    try {
      const { webDB } = require("../db/web");
      webDB().prepare(
        `INSERT INTO discord_users (discord_id, username, avatar, last_seen)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(discord_id) DO UPDATE SET username=excluded.username, avatar=excluded.avatar, last_seen=excluded.last_seen`
      ).run(discordUser.id, discordUser.username, avatar);
    } catch(e) { console.error("discord_users upsert:", e.message); }

    const payload = { id: discordUser.id, username: discordUser.username, avatar, role };
    const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    const FRONTEND = process.env.FRONTEND_URL || "https://sunshinesquad.es";
    res.redirect(`${FRONTEND}/auth-callback.html#token=${token}`);

  } catch (err) {
    console.error("OAuth error:", err);
    res.status(500).send("Error de autenticación: " + err.message);
  }
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No autenticado" });
  try {
    res.json(jwt.verify(token, process.env.JWT_SECRET));
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
});

module.exports = router;
