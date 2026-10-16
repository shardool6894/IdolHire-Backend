// Usage: npm run seed
// Adds (or refreshes) the starter question sequences recruiters pick from.
require("dotenv").config();
const mongoose = require("mongoose");
const QuestionSequence = require("../models/questionSequence");

// q(prompt, guidance): `guidance` is recruiter-only notes on what a strong answer covers.
const q = (prompt, guidance) => ({ prompt, guidance });

const sequences = [
  {
    name: "Robotic Welding Cell",
    questions: [
      q(
        "You're programming a robotic GMAW (MIG) cell to weld carbon-steel structural beams. Recommend a baseline shielding gas and justify it in terms of arc behavior and bead quality.",
        "Argon-rich mixes (e.g. 75-90% Ar / 10-25% CO2) are the usual baseline: stable arc, low spatter, good wetting and a flatter bead. 100% CO2 is cheaper with deeper penetration but a harsher arc and more spatter. Credit tying the choice to transfer mode (short-circuit vs spray) and cleanup cost."
      ),
      q(
        "Weld porosity starts appearing partway through a shift on a robotic cell that was producing clean welds. List the first things you'd check, in order, and why.",
        "Shielding gas first (flow rate, leaks, hoses, regulator/solenoid, drafts), then nozzle condition and spatter buildup, contact tip and wire feed, base-material contamination (oil, rust, mill scale), moisture in wire or gas. Credit a logical order from cheapest/fastest check to most disruptive."
      ),
      q(
        "For a thick-section fillet joint, how would you decide between a weave pattern and multiple stringer passes, and what would you change in the robot program to implement your choice?",
        "Heat input and interpass temperature control, distortion, fusion at the toe/root, joint size and position. Program levers: weave amplitude/frequency/dwell, travel speed, work and travel angles, start/end offsets, pass sequence."
      ),
      q(
        "Parts reach the cell with inconsistent fit-up: the root gap varies between 1 and 3 mm. How would you make the process tolerant of this?",
        "Sensing options (touch sensing, laser seam tracking, through-arc tracking), adaptive parameters or fill strategy based on measured gap, better fixturing, and raising the issue upstream with whoever produces the parts. Credit weighing cost and complexity."
      ),
      q(
        "A colleague proposes raising travel speed by 25% to increase throughput. What effects would you expect on penetration and bead profile, and how would you validate the change before releasing it?",
        "Lower heat input per length: shallower penetration, narrower bead, higher risk of undercut, humping or lack of fusion unless wire feed and voltage are rebalanced. Validation: trial welds, macro-etch or cross-section, destructive/NDT testing against the qualified procedure, and a small controlled lot before release."
      ),
    ],
  },
  {
    name: "Web Debugging Scenarios",
    questions: [
      q(
        "A React page keeps showing a stale value after a button click, even though the click handler definitely runs. What are the likely causes, and how would you narrow them down?",
        "Mutating state instead of replacing it, stale closures, missing effect dependencies, reading state right after setState, derived state copied into another state. Narrowing: log inside the handler and render, React DevTools, minimal reproduction."
      ),
      q(
        "An API endpoint is slow only for some users. How would you investigate?",
        "Compare slow vs fast users (data volume, permissions, region, device), look at latency percentiles and traces/logs, check queries for N+1 patterns, missing indexes and large payloads, check caching, then reproduce with the slow user's data. Credit a hypothesis-driven approach over guessing."
      ),
      q(
        "Users report that clicking 'Pay' twice sometimes creates two orders. Explain why this happens and how you would prevent it at more than one layer.",
        "Race between duplicate requests. Prevent: disable the button while pending (UI), idempotency keys or deduplication on the server, unique constraints or transactions in the database. Credit recognizing the UI fix alone is not enough."
      ),
    ],
  },
];

// The earlier multiple-choice starter sets don't fit the open-ended format any more.
const RETIRED = ["JavaScript Fundamentals", "React Basics"];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI);

  const removed = await QuestionSequence.deleteMany({ name: { $in: RETIRED } });
  if (removed.deletedCount) console.log(`Removed ${removed.deletedCount} old multiple-choice sequence(s)`);

  for (const s of sequences) {
    await QuestionSequence.findOneAndUpdate({ name: s.name }, s, { upsert: true, runValidators: true });
    console.log(`Seeded "${s.name}" (${s.questions.length} stages)`);
  }
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
