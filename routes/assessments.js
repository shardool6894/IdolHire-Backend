const express = require("express");
const {
  createAssessment,
  listAssessments,
  updateAssessmentStatus,
  getResults,
  getAttemptDetail,
} = require("../controllers/assessments");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Everything here is recruiter-only; each handler also checks the assessment belongs to them.
router.use(requireAuth, requireRole("recruiter"));

router.get("/", listAssessments);
router.post("/", createAssessment);
router.patch("/:id", updateAssessmentStatus);
router.get("/:id/results", getResults);
router.get("/:id/results/:attemptId", getAttemptDetail);

module.exports = router;
