const mongoose = require("mongoose");

// One stage of an assessment: an open-ended scenario the candidate answers in writing.
const questionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, trim: true, maxlength: 2000 },
    // Recruiter-only notes on what a strong answer covers. Never sent to candidates
    // or to the Helper, so neither can leak it.
    guidance: { type: String, trim: true, maxlength: 2000 },
    // Optional rubric axis for the scorer, e.g. "Technical Correctness". Blank = generic "Answer Quality".
    axis: { type: String, trim: true, maxlength: 60 },
    // Optional claim from an "AI copilot" that the candidate is expected to scrutinise. Shown to the
    // candidate with the question, and given to the scorer.
    trapClaim: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const questionSequenceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    // Restricts the sequence to specific roles so SDE and Manufacturing aren't mixed up.
    domain: { 
      type: String, 
      required: true, 
      enum: ['SDE', 'Manufacturing', 'General'],
      default: 'General'
    },
    // Background notes the Helper searches when answering hints. Paragraphs separated by a blank line.
    // Keep it neutral: it is given to the Helper, so don't put the answers in it.
    sourceMaterial: { type: String, maxlength: 20000 },
    questions: { type: [questionSchema], default: [] },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.QuestionSequence || mongoose.model("QuestionSequence", questionSequenceSchema);