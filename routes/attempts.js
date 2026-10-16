const express = require("express");
const rateLimit = require("express-rate-limit");
const { joinAssessment, saveAnswer, submitAttempt } = require("../controllers/attempts");
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

router.use(requireAuth, requireRole("candidate"));

router.post("/join", joinLimiter, joinAssessment);
router.post("/:id/answers", saveAnswer);
router.post("/:id/submit", submitAttempt);

module.exports = router;
