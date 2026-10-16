const express = require("express");
const { listQuestionSequences } = require("../controllers/assessments");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, requireRole("recruiter"), listQuestionSequences);

module.exports = router;
