// backend/routes/sandbox.js
const express = require("express");
const router = express.Router();

// Using Piston API for this example (no API key required for basic testing)
// For production, you can point this to your own hosted Piston or Judge0 instance.
router.post("/execute", async (req, res, next) => {
  try {
    const { language, version, code } = req.body;

    if (!code || !language) {
      return res.status(400).json({ error: "Language and code are required." });
    }

    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: language,
        version: version || "*", // "*" uses the latest available version
        files: [{ content: code }],
      }),
    });

    const data = await response.json();
    
    // Parse response for frontend
    if (data.run) {
      res.json({
        output: data.run.stdout || data.run.stderr,
        exitCode: data.run.code,
        error: data.run.stderr ? true : false
      });
    } else {
      res.status(400).json({ error: data.message || "Execution failed" });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;