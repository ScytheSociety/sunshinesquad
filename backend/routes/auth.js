const express = require("express");
const router  = express.Router();
const jwt     = require("jsonwebtoken");
const { botDB } = require("../db/bot");

const DISCORD_API = "https://discord.com/api/v10";

// Determina el rol del usuario según tablas del bot
function getRoleFromDB(discordId) {
  try {
    const db = botDB();
    // Primero verificar permisos globales
    const perm = db.prepare(`SELECT permission_level FROM permissions WHERE discord_id = ? LIMIT 1`).get(discordId);
    if (perm) {
      const lvl = perm.permission_level;
      if (lvl >= 4) return "admin";
      if (lvl >= 3) return "moderador";
      if (lvl >= 2) return "editor";
    }
    // Verificar si es miembro (tiene algún registro en user_game_stats)
    const miembro = db.prepare(`SELECT 1 FROM user_game_stats WHERE discord_id = ? LIMIT 1`).get(discordId);
    if (miembro) return "miembro";
  } catch {}
  return "visitante";
}

// GET /api/auth/discord  → redirige a Discord OAuth
router.get("/discord", (req, res) => {
  const params = new URLSearchParams({
    client_id:     process.env.DISCORD_CLIENT_ID,
    redirect_uri:  process.env.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope:         "identify",
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

// GET /api/auth/callback  → maneja el código de Discord
router.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Código faltante");

  try {
    // Intercambiar código por token
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
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

    // Obtener info del usuario
    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    const role = getRoleFromDB(discordUser.id);
    const avatar = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${(BigInt(discordUser.id) >> 22n) % 6n}.png`;

    const payload = {
      id:       discordUser.id,
      username: discordUser.username,
      avatar,
      role,
    };

    const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    // Redirige al frontend con el token en hash (nunca en query string)
    const FRONTEND = process.env.FRONTEND_URL || "https://sunshinesquad.com";
    res.redirect(`${FRONTEND}/auth-callback.html#token=${jwtToken}`);

  } catch (err) {
    console.error("OAuth error:", err);
    res.status(500).send("Error de autenticación");
  }
});

// GET /api/auth/me  → devuelve info del usuario autenticado
router.get("/me", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No autenticado" });
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    res.json(user);
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
});

module.exports = router;
