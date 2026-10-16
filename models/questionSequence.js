const mongoose = require("mongoose");

// One stage of an assessment: an open-ended scenario the candidate answers in writing.
const questionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, trim: true, maxlength: 2000 },
    // Recruiter-only notes on what a strong answer covers. Never sent to candidates
    // or to the Helper, so neither can leak it.
    guidance: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: false }
);

const questionSequenceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.QuestionSequence || mongoose.model("QuestionSequence", questionSequenceSchema);
