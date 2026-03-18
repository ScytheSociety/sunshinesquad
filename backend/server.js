require("dotenv").config();
const express = require("express");
const cors    = require("cors");

const app = express();

// CORS: solo permite el dominio del frontend
const FRONTEND = process.env.FRONTEND_URL || "https://sunshinesquad.es";
app.use(cors({
  origin: [FRONTEND, "http://localhost:5173", "http://127.0.0.1:5500", "http://localhost:8080"],
  credentials: true,
}));

app.use(express.json());
app.set("trust proxy", 1); // necesario para IP real tras NGINX

// ── Rutas ────────────────────────────────────────────────────────────
app.use("/api/auth",      require("./routes/auth"));
app.use("/api/events",    require("./routes/events"));
app.use("/api/mvp",       require("./routes/mvp"));
app.use("/api/birthdays", require("./routes/birthdays"));
app.use("/api/ranking",   require("./routes/ranking"));
app.use("/api/blog",      require("./routes/blog"));
app.use("/api/push",      require("./routes/push"));
app.use("/api/tierlist",    require("./routes/tierlist"));
app.use("/api/tl-catalog", require("./routes/tl-catalog"));
app.use("/api/clan",       require("./routes/clan"));
app.use("/api/games",      require("./routes/games"));
app.use("/api/schedule",   require("./routes/schedule"));
app.use("/api/bank",       require("./routes/bank"));
app.use("/api/calendar",   require("./routes/calendar"));
app.use("/api/streams",    require("./routes/streams"));
app.use("/api/images",     require("./routes/images"));
app.use("/api/profile",   require("./routes/profile"));
app.use("/api/config",    require("./routes/config"));

// ── Health check ─────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  const { botDB } = require("./db/bot");
  const { webDB } = require("./db/web");
  let botOk = false, webOk = false;
  try { botDB().prepare("SELECT 1").get(); botOk = true; } catch {}
  try { webDB().prepare("SELECT 1").get(); webOk = true; } catch {}
  res.json({
    ok: botOk && webOk,
    version: require("./package.json").version,
    env: process.env.NODE_ENV || "production",
    uptime_s: Math.floor(process.uptime()),
    ts: new Date().toISOString(),
    db: { bot: botOk, web: webOk },
  });
});

// ── 404 ──────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

// ── Error handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`✅ API corriendo en http://127.0.0.1:${PORT}`);
});
