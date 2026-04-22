// auth.js — Simple token-based auth middleware
const crypto = require("crypto");
const { stmts } = require("./db");

// Generate a secure random token
function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Hash password with SHA-256 + salt (simple, no bcrypt needed for demo)
function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.createHmac("sha256", s).update(password).digest("hex");
  return { hash, salt: s, stored: `${s}:${hash}` };
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const { hash: computed } = hashPassword(password, salt);
  return computed === hash;
}

// Middleware: optionally authenticate (attaches req.user if token valid)
function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    try {
      const session = stmts.getSession.get(token);
      if (session) req.user = { id: session.uid, username: session.username, email: session.email };
    } catch {}
  }
  next();
}

// Middleware: require authentication
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  const session = stmts.getSession.get(token);
  if (!session) return res.status(401).json({ error: "Invalid or expired token" });
  req.user = { id: session.uid, username: session.username, email: session.email };
  next();
}

module.exports = { generateToken, hashPassword, verifyPassword, optionalAuth, requireAuth };
