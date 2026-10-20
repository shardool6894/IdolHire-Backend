const crypto = require("crypto");
const Assessment = require("../models/assessment");
const Attempt = require("../models/attempt");
const QuestionSequence = require("../models/questionSequence");

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const MAX_MINUTES = 480;
const MAX_STAGE_SCORE = 5; // the AI service scores each stage 0-5

// No 0/O/1/I so tokens are easy to read out loud. 32 characters, so
// `byte % 32` has no modulo bias.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateToken() {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out; // e.g. "K7QM-X2RT"
}

// Sum of the stage scores that exist, or null when nothing has been graded yet.
const totalScore = (attempt) =>
  attempt.evaluations.length ? attempt.evaluations.reduce((sum, e) => sum + e.score, 0) : null;

// Not stored: derived from the timestamps so it can never go stale.
function attemptStatus(attempt, now = new Date()) {
  if (attempt.submittedAt) return "complete";
  return now > attempt.expiresAt ? "expired" : "in_progress";
}

// Loads an assessment only if it belongs to the logged-in recruiter.
// Returns null for "doesn't exist" and "isn't yours" alike, so ids can't be probed.
async function findOwned(req) {
  if (!OBJECT_ID_RE.test(req.params.id)) return null;
  return Assessment.findOne({ _id: req.params.id, recruiter: req.user._id }).populate(
    "questionSequence",
    "name questions"
  );
}

// ---------- controllers (recruiter only) ----------

// GET /api/question-sequences
exports.listQuestionSequences = async (req, res, next) => {
  try {
    const { typeOfInterview } = req.query;
    
    // Map the frontend role selection to the new schema domain
    let filter = {};
    if (typeOfInterview === "SDE") {
      filter.domain = "SDE";
    } else if (typeOfInterview === "Non-SDE") {
      filter.domain = "Manufacturing";
    }

    const sequences = await QuestionSequence.find(filter).select("name").sort("name");
    res.json({ sequences: sequences.map((s) => ({ id: s._id, name: s.name })) });
  } catch (err) {
    next(err);
  }
};

// POST /api/assessments  { questionSequenceId, durationMinutes }
exports.createAssessment = async (req, res, next) => {
  try {
    const { questionSequenceId, durationMinutes, typeOfInterview } = req.body;

    if (!["SDE", "Non-SDE"].includes(typeOfInterview)) {
      return res.status(400).json({ error: "Pick an interview type" });
    }

    if (typeof questionSequenceId !== "string" || !OBJECT_ID_RE.test(questionSequenceId)) {
      return res.status(400).json({ error: "Pick a question sequence" });
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > MAX_MINUTES) {
      return res.status(400).json({ error: `Duration must be a whole number from 1 to ${MAX_MINUTES} minutes` });
    }
    if (!(await QuestionSequence.exists({ _id: questionSequenceId }))) {
      return res.status(404).json({ error: "Question sequence not found" });
    }

    // Token collisions are very unlikely, but the unique index is the real guard: retry if one hits.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const assessment = await Assessment.create({
          recruiter: req.user._id,
          typeOfInterview: typeOfInterview,
          questionSequence: questionSequenceId,
          durationMinutes,
          token: generateToken(),
        });
        await assessment.populate("questionSequence", "name");
        return res.status(201).json({ assessment: assessment.toPublic() });
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }
    return res.status(500).json({ error: "Could not generate a unique token, please try again" });
  } catch (err) {
    next(err);
  }
};

// GET /api/assessments   (the logged-in recruiter's assessments, newest first)
exports.listAssessments = async (req, res, next) => {
  try {
    const assessments = await Assessment.find({ recruiter: req.user._id })
      .sort({ createdAt: -1 })
      .populate("questionSequence", "name");
    res.json({ assessments: assessments.map((a) => a.toPublic()) });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/assessments/:id  { status: "OPEN" | "CLOSED" }
// Closing stops new candidates from joining with the token; attempts already running continue.
exports.updateAssessmentStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (status !== "OPEN" && status !== "CLOSED") {
      return res.status(400).json({ error: "Status must be OPEN or CLOSED" });
    }
    const assessment = await findOwned(req);
    if (!assessment) return res.status(404).json({ error: "Assessment not found" });

    assessment.status = status;
    await assessment.save();
    res.json({ assessment: assessment.toPublic() });
  } catch (err) {
    next(err);
  }
};

// GET /api/assessments/:id/results
exports.getResults = async (req, res, next) => {
  try {
    const assessment = await findOwned(req);
    if (!assessment) return res.status(404).json({ error: "Assessment not found" });

    const attempts = await Attempt.find({ assessment: assessment._id })
      .populate("candidate", "email name")
      .sort({ createdAt: -1 });

    const now = new Date();
    const total = assessment.questionSequence.questions.length;
    res.json({
      assessment: assessment.toPublic(),
      results: attempts.map((a) => ({
        id: a._id,
        email: a.candidate?.email ?? "(deleted user)",
        name: a.candidate?.name,
        status: attemptStatus(a, now),
        answered: a.answers.length,
        total,
        score: totalScore(a),
        maxScore: total * MAX_STAGE_SCORE,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/assessments/:id/results/:attemptId
// One candidate's written answers, AI scores and Helper conversation, stage by stage, next to the recruiter's guidance notes.
exports.getAttemptDetail = async (req, res, next) => {
  try {
    const assessment = await findOwned(req);
    if (!assessment || !OBJECT_ID_RE.test(req.params.attemptId)) {
      return res.status(404).json({ error: "Attempt not found" });
    }
    const attempt = await Attempt.findOne({ _id: req.params.attemptId, assessment: assessment._id }).populate(
      "candidate",
      "email name"
    );
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });

    const questions = assessment.questionSequence.questions;
    res.json({
      attempt: {
        id: attempt._id,
        email: attempt.candidate?.email ?? "(deleted user)",
        name: attempt.candidate?.name,
        status: attemptStatus(attempt),
        answered: attempt.answers.length,
        total: questions.length,
        score: totalScore(attempt),
        maxScore: questions.length * MAX_STAGE_SCORE,
        overallFeedback: attempt.overallFeedback ?? null,
        aiSteeringScore: attempt.aiSteeringScore ?? null,
        aiSteeringRationale: attempt.aiSteeringRationale ?? null,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
      },
      // One entry per stage: the question, what the candidate wrote (null if never reached),
      // and how they used the Helper on it.
      responses: questions.map((q, i) => {
        const evaluation = attempt.evaluations.find((e) => e.stage === i);
        return {
          prompt: q.prompt,
          guidance: q.guidance ?? null,
          axis: q.axis ?? null,
          trapClaim: q.trapClaim ?? null,
          answer: attempt.answers[i] ?? null,
          score: evaluation?.score ?? null,
          rationale: evaluation?.rationale ?? null,
          helper: attempt.helperMessages
            .filter((m) => m.stage === i)
            .map((m) => ({ role: m.role, content: m.content })),
        };
      }),
    });
  } catch (err) {
    next(err);
  }
};

exports._internals = { generateToken, attemptStatus };
