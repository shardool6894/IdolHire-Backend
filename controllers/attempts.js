const Assessment = require("../models/assessment");
const Attempt = require("../models/attempt");

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
// Network lag / slow clocks: accept a submit that lands this long after expiry.
const SUBMIT_GRACE_MS = 30 * 1000;

// What a candidate is allowed to see: never `correctIndex`.
function questionsForCandidate(sequence) {
  return sequence.questions.map((q) => ({ prompt: q.prompt, options: q.options, points: q.points }));
}

function attemptPayload(attempt, assessment) {
  return {
    attempt: { id: attempt._id, startedAt: attempt.startedAt, expiresAt: attempt.expiresAt },
    durationMinutes: assessment.durationMinutes,
    questions: questionsForCandidate(assessment.questionSequence),
  };
}

// ---------- controllers (candidate only) ----------

// POST /api/attempts/join  { token }
// Starts the candidate's attempt (and the clock), or resumes it if already started.
exports.joinAssessment = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({ error: "Enter the assessment token" });
    }

    // Same message for "no such token" and "closed" so tokens can't be probed.
    const assessment = await Assessment.findOne({ token: token.trim().toUpperCase(), status: "OPEN" }).populate(
      "questionSequence"
    );
    if (!assessment) return res.status(404).json({ error: "Invalid or closed assessment token" });

    let attempt = await Attempt.findOne({ assessment: assessment._id, candidate: req.user._id });

    if (!attempt) {
      const startedAt = new Date();
      try {
        attempt = await Attempt.create({
          assessment: assessment._id,
          candidate: req.user._id,
          startedAt,
          expiresAt: new Date(startedAt.getTime() + assessment.durationMinutes * 60 * 1000),
        });
        return res.status(201).json(attemptPayload(attempt, assessment));
      } catch (err) {
        if (err.code !== 11000) throw err;
        // Double-click / two tabs: the other request won, so load its attempt.
        attempt = await Attempt.findOne({ assessment: assessment._id, candidate: req.user._id });
      }
    }

    if (attempt.submittedAt) {
      return res.status(409).json({ error: "You have already submitted this assessment" });
    }
    if (new Date() > attempt.expiresAt.getTime() + SUBMIT_GRACE_MS) {
      return res.status(403).json({ error: "Time is up for this assessment" });
    }
    return res.json(attemptPayload(attempt, assessment));
  } catch (err) {
    next(err);
  }
};

// POST /api/attempts/:id/submit  { answers: [optionIndex | null, ...] }  (one per question, in order)
exports.submitAttempt = async (req, res, next) => {
  try {
    if (!OBJECT_ID_RE.test(req.params.id)) return res.status(404).json({ error: "Attempt not found" });

    const attempt = await Attempt.findOne({ _id: req.params.id, candidate: req.user._id });
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    if (attempt.submittedAt) return res.status(409).json({ error: "Already submitted" });
    if (Date.now() > attempt.expiresAt.getTime() + SUBMIT_GRACE_MS) {
      return res.status(403).json({ error: "Time is up for this assessment" });
    }

    const assessment = await Assessment.findById(attempt.assessment).populate("questionSequence");
    const questions = assessment.questionSequence.questions;

    const { answers } = req.body;
    const valid =
      Array.isArray(answers) &&
      answers.length === questions.length &&
      answers.every((a, i) => a === null || (Number.isInteger(a) && a >= 0 && a < questions[i].options.length));
    if (!valid) return res.status(400).json({ error: "Answers must be one option index (or null) per question" });

    let score = 0;
    let maxScore = 0;
    questions.forEach((q, i) => {
      maxScore += q.points;
      if (answers[i] === q.correctIndex) score += q.points;
    });

    // Conditional update so two simultaneous submits can't both win.
    const saved = await Attempt.findOneAndUpdate(
      { _id: attempt._id, submittedAt: { $exists: false } },
      { $set: { answers, score, maxScore, submittedAt: new Date() } },
      { new: true }
    );
    if (!saved) return res.status(409).json({ error: "Already submitted" });

    res.json({ result: { score, maxScore } });
  } catch (err) {
    next(err);
  }
};
