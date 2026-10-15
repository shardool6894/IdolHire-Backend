const jwt = require("jsonwebtoken");
const User = require("../models/User");

const COOKIE_NAME = "token";

// Reads the JWT from the httpOnly cookie (or an "Authorization: Bearer" header),
// loads the user, and attaches it to req.user.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token =
      req.cookies?.[COOKIE_NAME] || (header?.startsWith("Bearer ") ? header.slice(7) : null);
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

// Use after requireAuth, e.g. router.get("/x", requireAuth, requireRole("recruiter"), handler)
const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user?.role) ? next() : res.status(403).json({ error: "Forbidden" });

module.exports = { COOKIE_NAME, requireAuth, requireRole };