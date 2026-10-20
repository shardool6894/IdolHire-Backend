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
    // Neutral background the Helper can search. Definitions only: don't put the answers in here.
    // Paragraphs are separated by a blank line, and each one is searched separately.
    sourceMaterial: [
      "Gas metal arc welding, often called MIG welding, feeds a continuous consumable wire electrode through a torch while shielding gas flows around the arc and the weld pool. In a robotic cell the robot moves the torch along a programmed path, while the power source controls wire feed speed and voltage.",
      "Shielding gas protects the molten weld pool from oxygen, nitrogen and moisture in the surrounding air. The gas composition influences arc stability, spatter, how metal transfers across the arc, how deeply the weld penetrates and how the finished bead looks.",
      "Metal transfer mode describes how filler metal moves across the arc to the weld pool. In short circuit transfer the wire repeatedly touches the pool. In spray transfer a steady stream of fine droplets crosses the arc. Pulsed transfer alternates between a high and a low current.",
      "Porosity means gas pockets trapped inside solidified weld metal. It weakens the weld and is usually found by visual inspection, radiography or ultrasonic testing.",
      "Heat input is the energy delivered to the work per unit length of weld. It depends on current, voltage and travel speed, and it affects penetration, bead shape, distortion and the properties of the heat affected zone.",
      "A weave pattern moves the torch from side to side while travelling, which makes a wider bead. A stringer bead is a narrow pass made without side to side motion. Thick joints are often built up from several passes laid on top of or beside each other, with the interpass temperature kept within a limit.",
      "Fit-up describes how well the parts line up before welding, including the root gap between them. A fixture holds the parts in position. A welding procedure specification, or WPS, records the parameters that have been qualified for a particular weld.",
      "A macro etch is a way of examining a polished and etched cross section of a weld to see its penetration, fusion and bead profile. Destructive tests such as bend tests and non destructive tests such as dye penetrant are used to check weld quality.",
    ].join("\n\n"),
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
];

// Earlier starter sets that no longer fit.
// "Web Debugging Scenarios" was dropped too: the AI service's Helper is written for engineering and
// manufacturing subjects, so it would treat software questions as off topic.
const RETIRED = ["JavaScript Fundamentals", "React Basics", "Web Debugging Scenarios"];

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
