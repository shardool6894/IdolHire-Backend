require("dotenv").config();
const mongoose = require("mongoose");
const QuestionSequence = require("../models/questionSequence");

const q = (prompt, options, correctIndex, points = 1) => ({ prompt, options, correctIndex, points });

const sequences = [
  {
    name: "JavaScript Fundamentals",
    questions: [
      q("What does typeof null return?", ["null", "undefined", "object", "number"], 2),
      q("Which keyword declares a block-scoped variable that cannot be reassigned?", ["var", "let", "const", "function"], 2),
      q("What does [1, 2, 3].map(x => x * 2) return?", ["[2, 4, 6]", "6", "undefined", "[1, 2, 3]"], 0),
      q("How does === differ from ==?", ["It only compares types", "It compares value and type without coercion", "It assigns a value", "It only compares references"], 1),
      q("Which array method adds an element to the end?", ["shift", "unshift", "push", "pop"], 2),
    ],
  },
  {
    name: "React Basics",
    questions: [
      q("Which hook adds state to a function component?", ["useRef", "useState", "useMemo", "useContext"], 1),
      q("Which prop gives list items a stable identity?", ["id", "key", "ref", "index"], 1),
      q("When does useEffect(fn, []) run?", ["On every render", "Once after the first render", "Never", "Before every render"], 1),
      q("What is JSX?", ["A CSS preprocessor", "A syntax extension for JavaScript", "A database query language", "A bundler"], 1),
    ],
  },
];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI);
  for (const s of sequences) {
    await QuestionSequence.findOneAndUpdate({ name: s.name }, s, { upsert: true, runValidators: true });
    console.log(`Seeded "${s.name}" (${s.questions.length} questions)`);
  }
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
