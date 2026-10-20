// Usage:
//   npm run audit            -> list assessments whose question sequence doesn't match their interview type
//   npm run audit -- --close -> same, and also CLOSE the still-open ones so no new candidate can join them
//
// Nothing is deleted or re-typed: which side is "wrong" (the type or the sequence) is the recruiter's call.
// Closing only stops new joins; attempts already running are untouched.
require("dotenv").config();
const mongoose = require("mongoose");
const Assessment = require("../models/assessment");
require("../models/questionSequence"); // registers the model for populate()
const Attempt = require("../models/attempt");
const { sequenceMatchesType, domainFor } = require("../config/interviewTypes");

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  const shouldClose = process.argv.includes("--close");
  await mongoose.connect(process.env.MONGODB_URI);

  const assessments = await Assessment.find().populate("questionSequence", "name domain");
  const bad = assessments.filter((a) => !sequenceMatchesType(a.questionSequence, a.typeOfInterview));

  if (bad.length === 0) {
    console.log(`Checked ${assessments.length} assessment(s): all question sequences match their interview type.`);
  } else {
    console.log(`Checked ${assessments.length} assessment(s): ${bad.length} mismatched.\n`);
    for (const a of bad) {
      const attempts = await Attempt.countDocuments({ assessment: a._id });
      const seq = a.questionSequence;
      console.log(
        `- token ${a.token} [${a.status}] created ${a.createdAt.toISOString().slice(0, 10)}\n` +
          `    interview type : ${a.typeOfInterview} (expects domain "${domainFor(a.typeOfInterview)}")\n` +
          `    sequence       : ${seq ? `"${seq.name}" (domain "${seq.domain ?? "none"}")` : "MISSING"}\n` +
          `    candidate attempts so far: ${attempts}`
      );
    }

    if (shouldClose) {
      const ids = bad.filter((a) => a.status === "OPEN").map((a) => a._id);
      const result = await Assessment.updateMany({ _id: { $in: ids } }, { $set: { status: "CLOSED" } });
      console.log(`\nClosed ${result.modifiedCount} open mismatched assessment(s).`);
    } else {
      console.log("\nRe-run with --close to stop new candidates joining the open ones.");
    }
  }

  // Sequences that no interview type can use, so recruiters never see them.
  const QuestionSequence = mongoose.model("QuestionSequence");
  const orphaned = await QuestionSequence.find({ domain: { $nin: ["SDE", "Manufacturing"] } }).select("name domain");
  if (orphaned.length) {
    console.log(`\nNote: ${orphaned.length} sequence(s) have a domain neither interview type can select:`);
    orphaned.forEach((s) => console.log(`  - "${s.name}" (domain "${s.domain ?? "none"}")`));
  }

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
