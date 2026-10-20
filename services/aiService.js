// Client for the separate Python AI service (the idolHire-AI repo).
// Needs AI_SERVICE_URL (e.g. http://localhost:8001) and AI_SERVICE_KEY (must match the service's).
// Every error thrown here has a user-safe `message` and an HTTP `status` for the controller to relay.

const TIMEOUT_MS = { helper: 30_000, evaluate: 90_000, finalize: 90_000 };

class AiServiceError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

async function post(path, body, label) {
  const base = process.env.AI_SERVICE_URL;
  if (!base) throw new AiServiceError("The AI service isn't set up on this server", 503);

  let res;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ai-key": process.env.AI_SERVICE_KEY || "" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS[label]),
    });
  } catch (err) {
    console.error(`AI service ${path} unreachable: ${err.name}`);
    throw new AiServiceError(
      err.name === "TimeoutError" ? "The AI service took too long to respond" : "Couldn't reach the AI service"
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 401 = AI_SERVICE_KEY differs between the two servers; 422 = we sent something the service rejects.
    console.error(`AI service ${path} -> ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
    // 503/429 are the service's own "busy, try again" answers, so pass those on.
    const busy = res.status === 503 || res.status === 429;
    throw new AiServiceError(busy ? data.error || "The AI service is busy" : "The AI service had a problem", busy ? res.status : 502);
  }
  return data;
}

// Hint for the current stage. `sequence` is a QuestionSequence document, `history` is this stage's
// earlier chat as [{ role: "candidate" | "helper", content }]. Sends only the question text and the
// sequence's background material: never the recruiter's guidance.
async function askHelper({ sequence, prompt, history, message }) {
  const data = await post(
    "/helper",
    {
      prompt,
      sequence: { id: String(sequence._id), title: sequence.name, source_material: sequence.sourceMaterial || null },
      history,
      message,
    },
    "helper"
  );
  if (typeof data.reply !== "string" || !data.reply.trim()) throw new AiServiceError("The Helper didn't return an answer");
  return data.reply;
}

// Scores one written answer 0-5. `question` is a stage from the sequence, `previous` the already-graded
// earlier stages as [{ stage, axis, score, rationale }]. Always asks for a final score (force_final),
// so the service never replies with a follow-up question.
async function evaluateAnswer({ question, answer, previous }) {
  const data = await post(
    "/evaluate",
    {
      question: {
        prompt: question.prompt,
        guidance: question.guidance || null,
        trap_claim: question.trapClaim || null,
        axis: question.axis || null,
      },
      answer,
      previous: previous.map((p) => ({
        order_index: p.stage + 1,
        stage_type: p.axis || "Answer Quality",
        score: p.score,
        rationale: p.rationale,
      })),
      force_final: true,
    },
    "evaluate"
  );
  if (data.decision !== "final" || !Number.isInteger(data.score)) throw new AiServiceError("The AI service returned no score");
  return { score: data.score, rationale: data.rationale };
}

// Closing summary: overall feedback plus how well the candidate used the Helper.
// `stages` is [{ stage, axis, score, rationale }], `helperMessages` is [{ role, content }].
async function finalizeSession({ stages, helperMessages }) {
  const data = await post(
    "/finalize",
    {
      stages: stages.map((s) => ({ stage: s.stage, axis: s.axis || null, score: s.score, rationale: s.rationale })),
      helper_messages: helperMessages,
    },
    "finalize"
  );
  return {
    overallFeedback: data.overall_feedback,
    aiSteeringScore: data.ai_steering_score,
    aiSteeringRationale: data.ai_steering_rationale,
  };
}

module.exports = { AiServiceError, askHelper, evaluateAnswer, finalizeSession };
