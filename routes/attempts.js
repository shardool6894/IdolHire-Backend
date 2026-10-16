const express = require("express");
const rateLimit = require("express-rate-limit");
const { joinAssessment, askHelperHint, lockHelper, saveAnswer, submitAttempt } = require("../controllers/attempts");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Tokens are short, so slow down anyone trying to guess them.
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});

// Every Helper question is a paid AI call, so cap them per candidate (on top of the per-stage cap).
const helperLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { error: "You're asking the Helper too quickly. Wait a moment." },
});

router.use(requireAuth, requireRole("candidate"));

router.post("/join", joinLimiter, joinAssessment);
router.post("/:id/helper", helperLimiter, askHelperHint);
router.post("/:id/lock", lockHelper);
router.post("/:id/answers", saveAnswer);
router.post("/:id/submit", submitAttempt);

module.exports = router;
