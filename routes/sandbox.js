// backend/routes/sandbox.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Using Piston API for this example (no API key required for basic testing)
// For production, you can point this to your own hosted Piston or Judge0 instance.
// Allowlist: the client sends our key, never a free-form Piston language name.
const LANGUAGES = {
  javascript: "javascript",
  python: "python",
  java: "java",
  cpp: "c++",
};
const MAX_CODE_CHARS = 4000;
const MAX_OUTPUT_CHARS = 10_000;
const REQUEST_TIMEOUT_MS = 20_000;

const runLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { error: "You're running code too quickly. Wait a moment." },
});

router.use(requireAuth, requireRole("candidate"));

router.post("/execute", runLimiter, async (req, res, next) => {
  try {
    const { language, code } = req.body;
    const pistonLanguage = typeof language === "string" ? LANGUAGES[language] : undefined;

    if (!pistonLanguage) return res.status(400).json({ error: "Unsupported language." });
    if (typeof code !== "string" || !code.trim()) return res.status(400).json({ error: "Write some code first." });
    if (code.length > MAX_CODE_CHARS) {
      return res.status(400).json({ error: `Code can be at most ${MAX_CODE_CHARS} characters.` });
    }

    const base = (process.env.PISTON_URL || "https://emkc.org/api/v2/piston").replace(/\/$/, "");
    const headers = { "Content-Type": "application/json" };
    if (process.env.PISTON_API_KEY) headers.Authorization = process.env.PISTON_API_KEY;

    let response;
    try {
      response = await fetch(`${base}/execute`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          language: pistonLanguage,
          version: "*",
          files: [{ content: code }],
          compile_timeout: 10_000,
          run_timeout: 5_000,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      console.error(`Piston unreachable: ${err.name}`);
      return res.status(502).json({ error: "The code runner isn't available right now." });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.run) {
      console.error(`Piston -> ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
      return res.status(502).json({ error: "The code runner isn't available right now." });
    }

    // A failed compile step (Java, C++) has its own output and means the program never ran.
    const compileFailed = data.compile && data.compile.code !== 0;
    const output = (compileFailed ? data.compile.output : data.run.output) || "";
    res.json({
      output: output.slice(0, MAX_OUTPUT_CHARS),
      exitCode: compileFailed ? data.compile.code : data.run.code,
      error: compileFailed || data.run.code !== 0,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;