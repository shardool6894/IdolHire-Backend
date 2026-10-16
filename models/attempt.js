const mongoose = require("mongoose");

// One line of the candidate <-> Helper conversation, tagged with the stage it belongs to.
const helperMessageSchema = new mongoose.Schema(
  {
    stage: { type: Number, required: true },
    role: { type: String, enum: ["candidate", "helper"], required: true },
    content: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

// One candidate's go at one assessment.
const attemptSchema = new mongoose.Schema(
  {
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true }, // startedAt + duration, fixed when the attempt starts
    submittedAt: { type: Date },
    // Written answers, in stage order. Stages are answered one at a time and answers are
    // final, so this array only ever grows and `answers.length` is the current stage.
    answers: { type: [String], default: [] },
    // Stages where the Helper is locked (the candidate clicked "I'm ready to answer" or answered).
    lockedStages: { type: [Number], default: [] },
    helperMessages: { type: [helperMessageSchema], default: [] },
  },
  { timestamps: true }
);

// A candidate can only attempt each assessment once.
attemptSchema.index({ assessment: 1, candidate: 1 }, { unique: true });

module.exports = mongoose.models.Attempt || mongoose.model("Attempt", attemptSchema);
