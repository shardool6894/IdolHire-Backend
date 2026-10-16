const Assessment = require("../models/assessment");
const Attempt = require("../models/attempt");

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
// Network lag / slow clocks: accept a save or submit that lands this long after expiry.
const SUBMIT_GRACE_MS = 30 * 1000;

// What a candidate is allowed to see: never `correctIndex`.
function questionsForCandidate(sequence) {
  return sequence.questions.map((q) => ({ prompt: q.prompt, options: q.options, points: q.points }));
}

function attemptPayload(attempt, assessment) {
  const questions = assessment.questionSequence.questions;
  return {
    attempt: { id: attempt._id, startedAt: attempt.startedAt, expiresAt: attempt.expiresAt },
    durationMinutes: assessment.durationMinutes,
    questions: questionsForCandidate(assessment.questionSequence),
    // Saved answers so a refresh resumes where the candidate left off (null = not answered yet).
    answers: questions.map((_, i) => attempt.answers[i] ?? null),
    // Lets the browser correct for its own clock being off when showing the countdown.
    now: new Date(),
  };
}

// Valid answer = null (skipped) or the index of one of the question's options.
const isValidAnswer = (a, question) =>
  a === null || (Number.isInteger(a) && a >= 0 && a < question.options.length);

// Shared by save + submit: the attempt must be the caller's, not submitted, and not out of time.
// Sends the error response itself and returns null when any of that fails.
async function loadActiveAttempt(req, res) {
  if (!OBJECT_ID_RE.test(req.params.id)) {
    res.status(404).json({ error: "Attempt not found" });
    return null;
  }
  const attempt = await Attempt.findOne({ _id: req.params.id, candidate: req.user._id });
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return null;
  }
  if (attempt.submittedAt) {
    res.status(409).json({ error: "Already submitted" });
    return null;
  }
  if (Date.now() > attempt.expiresAt.getTime() + SUBMIT_GRACE_MS) {
    res.status(403).json({ error: "Time is up for this assessment" });
    return null;
  }
  const assessment = await Assessment.findById(attempt.assessment).populate("questionSequence");
  return { attempt, questions: assessment.questionSequence.questions };
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

// POST /api/attempts/:id/answers  { questionIndex, answer }
// Saves one stage as the candidate submits it, so progress survives a refresh.
exports.saveAnswer = async (req, res, next) => {
  try {
    const loaded = await loadActiveAttempt(req, res);
    if (!loaded) return;
    const { attempt, questions } = loaded;

    const { questionIndex, answer } = req.body;
    if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= questions.length) {
      return res.status(400).json({ error: "Unknown question" });
    }
    if (!isValidAnswer(answer, questions[questionIndex])) {
      return res.status(400).json({ error: "Answer must be one of the question's options" });
    }

    // Conditional update so a save can't land after the final submit.
    const saved = await Attempt.findOneAndUpdate(
      { _id: attempt._id, submittedAt: { $exists: false } },
      { $set: { [`answers.${questionIndex}`]: answer } }
    );
    if (!saved) return res.status(409).json({ error: "Already submitted" });

    res.json({ saved: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/attempts/:id/submit  { answers: [optionIndex | null, ...] }  (one per question, in order)
// Final submit: the answers sent here are the ones that get scored and shown to the recruiter.
exports.submitAttempt = async (req, res, next) => {
  try {
    const loaded = await loadActiveAttempt(req, res);
    if (!loaded) return;
    const { attempt, questions } = loaded;

    const { answers } = req.body;
    const valid =
      Array.isArray(answers) &&
      answers.length === questions.length &&
      answers.every((a, i) => isValidAnswer(a, questions[i]));
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
