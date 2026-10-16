const mongoose = require("mongoose");

// One candidate's go at one assessment.
const attemptSchema = new mongoose.Schema(
  {
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment", required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true }, // startedAt + duration, fixed when the attempt starts
    submittedAt: { type: Date },
    answers: { type: [Number], default: [] }, // option index per question, null = skipped
    score: { type: Number },
    maxScore: { type: Number },
  },
  { timestamps: true }
);

// A candidate can only attempt each assessment once.
attemptSchema.index({ assessment: 1, candidate: 1 }, { unique: true });

module.exports = mongoose.models.Attempt || mongoose.model("Attempt", attemptSchema);
