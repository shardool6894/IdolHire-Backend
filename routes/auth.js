const express = require("express");
const rateLimit = require("express-rate-limit");
const { register, login, googleAuth, me, logout } = require("../controllers/auth");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Slows down password guessing / signup spam from a single IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/google", authLimiter, googleAuth);
router.get("/me", requireAuth, me);
router.post("/logout", logout);

module.exports = router;