const Assessment = require("../models/assessment");
const Attempt = require("../models/attempt");
const { askHelper } = require("./helper");

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
// Network lag / slow clocks: accept an action that lands this long after expiry.
const SUBMIT_GRACE_MS = 30 * 1000;

const MAX_ANSWER_CHARS = 4000;
const MAX_HELPER_MESSAGE_CHARS = 500;
const MAX_HELPER_QUESTIONS_PER_STAGE = 10;

// What a candidate is allowed to see: the prompts only, never the recruiter's guidance.
const questionsForCandidate = (sequence) => sequence.questions.map((q) => ({ prompt: q.prompt }));

const helperMessagesFor = (attempt, stage) =>
  attempt.helperMessages.filter((m) => m.stage === stage).map((m) => ({ role: m.role, content: m.content }));

function attemptPayload(attempt, assessment) {
  const current = attempt.answers.length; // stages are answered in order, so this is the current stage
  return {
    attempt: { id: attempt._id, startedAt: attempt.startedAt, expiresAt: attempt.expiresAt },
    durationMinutes: assessment.durationMinutes,
    questions: questionsForCandidate(assessment.questionSequence),
    answers: attempt.answers, // already-submitted stages, so a refresh resumes where they left off
    // Helper state for the current stage only.
    helper: { locked: attempt.lockedStages.includes(current), messages: helperMessagesFor(attempt, current) },
    // Lets the browser correct for its own clock being off when showing the countdown.
    now: new Date(),
  };
}

// Shared by every in-test action: the attempt must be the caller's, not submitted, and not out of time.
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
  const questions = assessment.questionSequence.questions;
  const current = attempt.answers.length;
  if (current >= questions.length) {
    res.status(409).json({ error: "All stages are already answered" });
    return null;
  }
  return { attempt, questions, current };
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

// POST /api/attempts/:id/helper  { message }
// Ask the Helper for a hint on the current stage. Refused once the stage is locked.
exports.askHelperHint = async (req, res, next) => {
  try {
    const loaded = await loadActiveAttempt(req, res);
    if (!loaded) return;
    const { attempt, questions, current } = loaded;

    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!message) return res.status(400).json({ error: "Type a question for the Helper" });
    if (message.length > MAX_HELPER_MESSAGE_CHARS) {
      return res.status(400).json({ error: `Keep questions under ${MAX_HELPER_MESSAGE_CHARS} characters` });
    }
    if (attempt.lockedStages.includes(current)) {
      return res.status(403).json({ error: "The Helper is locked for this stage" });
    }

    const history = helperMessagesFor(attempt, current);
    const asked = history.filter((m) => m.role === "candidate").length;
    if (asked >= MAX_HELPER_QUESTIONS_PER_STAGE) {
      return res.status(429).json({ error: "You've used all your Helper questions for this stage" });
    }

    let reply;
    try {
      reply = await askHelper(questions[current].prompt, history, message);
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }

    // Only kept if the stage is still unlocked and unanswered: answering/locking in another
    // tab while the Helper was thinking must not let a late hint through.
    const saved = await Attempt.findOneAndUpdate(
      {
        _id: attempt._id,
        submittedAt: { $exists: false },
        answers: { $size: current },
        lockedStages: { $ne: current },
      },
      {
        $push: {
          helperMessages: {
            $each: [
              { stage: current, role: "candidate", content: message },
              { stage: current, role: "helper", content: reply },
            ],
          },
        },
      }
    );
    if (!saved) return res.status(409).json({ error: "The Helper is locked for this stage" });

    res.json({ reply, remaining: MAX_HELPER_QUESTIONS_PER_STAGE - asked - 1 });
  } catch (err) {
    next(err);
  }
};

// POST /api/attempts/:id/lock
// "I'm ready to answer": locks the Helper for the current stage for good.
exports.lockHelper = async (req, res, next) => {
  try {
    const loaded = await loadActiveAttempt(req, res);
    if (!loaded) return;
    const { attempt, current } = loaded;

    await Attempt.updateOne({ _id: attempt._id, submittedAt: { $exists: false } }, { $addToSet: { lockedStages: current } });
    res.json({ locked: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/attempts/:id/answers  { questionIndex, answer }
// Submits the written answer for the current stage. Final: it can't be changed afterwards.
exports.saveAnswer = async (req, res, next) => {
  try {
    const loaded = await loadActiveAttempt(req, res);
    if (!loaded) return;
    const { attempt, current } = loaded;

    const { questionIndex, answer } = req.body;
    if (questionIndex !== current) {
      return res.status(409).json({ error: "That isn't the current stage" });
    }
    const text = typeof answer === "string" ? answer.trim() : "";
    if (!text) return res.status(400).json({ error: "Write an answer before submitting" });
    if (text.length > MAX_ANSWER_CHARS) {
      return res.status(400).json({ error: `Answers can be at most ${MAX_ANSWER_CHARS} characters` });
    }

    // `$size: current` makes this atomic: it only applies if exactly the earlier stages are
    // answered, so a double-click or second tab can't record the same stage twice.
    // Answering also locks the Helper for the stage.
    const saved = await Attempt.findOneAndUpdate(
      { _id: attempt._id, submittedAt: { $exists: false }, answers: { $size: current } },
      { $push: { answers: text }, $addToSet: { lockedStages: current } }
    );
    if (!saved) return res.status(409).json({ error: "That stage was already answered" });

    res.json({ saved: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/attempts/:id/submit
// Final submit (also used by "End test" and the timer running out): stages not answered stay blank.
exports.submitAttempt = async (req, res, next) => {
  try {
    if (!OBJECT_ID_RE.test(req.params.id)) return res.status(404).json({ error: "Attempt not found" });
    const attempt = await Attempt.findOne({ _id: req.params.id, candidate: req.user._id });
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    if (attempt.submittedAt) return res.status(409).json({ error: "Already submitted" });
    if (Date.now() > attempt.expiresAt.getTime() + SUBMIT_GRACE_MS) {
      return res.status(403).json({ error: "Time is up for this assessment" });
    }

    // Conditional update so two simultaneous submits can't both win.
    const saved = await Attempt.findOneAndUpdate(
      { _id: attempt._id, submittedAt: { $exists: false } },
      { $set: { submittedAt: new Date() } }
    );
    if (!saved) return res.status(409).json({ error: "Already submitted" });

    res.json({ submitted: true });
  } catch (err) {
    next(err);
  }
};
