const mongoose = require("mongoose");

// Multiple-choice question. Answers are stored by position (index into `options`).
const questionSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true, trim: true },
    options: {
      type: [String],
      required: true,
      validate: { validator: (v) => v.length >= 2, message: "A question needs at least 2 options" },
    },
    correctIndex: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator(v) {
          return Number.isInteger(v) && v < this.options.length;
        },
        message: "correctIndex must point at one of the options",
      },
    },
    points: { type: Number, default: 1, min: 0 },
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
