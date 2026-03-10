const jwt = require("jsonwebtoken");

// Roles en orden de mayor a menor privilegio
const ROLE_LEVEL = { admin: 4, moderador: 3, editor: 2, miembro: 1, visitante: 0 };

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No autenticado" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

function requireRole(minRole) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      const level = ROLE_LEVEL[req.user.role] ?? 0;
      if (level < (ROLE_LEVEL[minRole] ?? 99)) {
        return res.status(403).json({ error: "Sin permisos suficientes" });
      }
      next();
    });
  };
}

module.exports = { requireAuth, requireRole };
