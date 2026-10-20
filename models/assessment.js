const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    questionSequence: { type: mongoose.Schema.Types.ObjectId, ref: "QuestionSequence", required: true },
    durationMinutes: { type: Number, required: true, min: 1, max: 480 },
    typeOfInterview: { type: String, enum: ["SDE", "Non-SDE"], default: "Non-SDE", required: true },
    // Short code the recruiter shares with candidates, e.g. "K7QM-X2RT".
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN" },
  },
  { timestamps: true }
);

// Only these fields ever leave the server.
assessmentSchema.methods.toPublic = function () {
  return {
    id: this._id,
    token: this.token,
    durationMinutes: this.durationMinutes,
    typeOfInterview: this.typeOfInterview,
    status: this.status,
    createdAt: this.createdAt,
    // Only present when questionSequence was populated.
    questionSequence: this.questionSequence?.name
      ? { id: this.questionSequence._id, name: this.questionSequence.name }
      : undefined,
  };
};

module.exports = mongoose.models.Assessment || mongoose.model("Assessment", assessmentSchema);
