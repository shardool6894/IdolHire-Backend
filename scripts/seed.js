// Usage: npm run seed
// Adds (or refreshes) the starter question sequences recruiters pick from.
require("dotenv").config();
const mongoose = require("mongoose");
const QuestionSequence = require("../models/questionSequence");

const q = (prompt, guidance) => ({ prompt, guidance });

const sequences = [
  // --- NON-SDE SEQUENCE ---
  {
    name: "Robotic Welding Cell",
    domain: "Manufacturing", // Strictly tags this for Non-SDE
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
  
  // --- SDE SEQUENCE ---
  {
    name: "SDE: Data Structures & Algorithms",
    domain: "SDE", // Strictly tags this for SDE
    // Neutral definitions only. The Helper searches this, so no answers in here.
    sourceMaterial: [
      "Time complexity describes how the number of steps an algorithm takes grows with the input size n, written in big O notation. Space complexity does the same for extra memory. O(1) is constant, O(log n) logarithmic, O(n) linear, O(n log n) linearithmic and O(n^2) quadratic.",
      "A hash map stores key and value pairs and finds a key in O(1) time on average by turning the key into an array index with a hash function. Different keys can collide, and the table resolves that with chaining or probing. A set is a hash map that stores keys only.",
      "A stack is a last in, first out collection. Push adds an item to the top, pop removes the top item and peek reads it. A queue is first in, first out, with items added at the back and removed from the front.",
      "A singly linked list is a chain of nodes, each holding a value and a reference to the next node, and the last node points to nothing. Reaching the k-th node means walking k links from the head. Changing the next references of nodes is how a list is rearranged without copying values.",
      "Binary search finds a value in a sorted array by comparing against the middle element and discarding the half that cannot contain it, so the search range shrinks by half each step. Lower bound is the first position whose value is not less than the target. Upper bound is the first position whose value is greater than the target.",
      "A grid can be treated as a graph where each cell is a node and neighbouring cells are connected. Depth first search follows one path as far as it goes before backing up, using recursion or a stack. Breadth first search visits nodes in rings of increasing distance, using a queue. Either one needs a record of visited nodes to avoid going in circles.",
      "Edge cases worth testing are the empty input, a single element, duplicate values, all elements equal, and the largest allowed input. Deep recursion can overflow the call stack, which is why some solutions use an explicit stack or queue instead.",
    ].join("\n\n"),
    questions: [
      {
        axis: "Arrays & Hashing",
        prompt:
          "Given an array of integers and a target, return the indices of two different elements that add up to the target. Write a function in the language of your choice, print its result for ([2, 7, 11, 15], 9) and ([3, 2, 4], 6), and state its time and space complexity.",
        guidance:
          "Strong: one pass with a hash map from value to index, checking target - x before inserting x: O(n) time, O(n) space. Brute force with two loops is O(n^2) time, O(1) space and is acceptable but scores lower unless the trade-off is explained. Credit handling of duplicates (3 + 3 = 6) and of no valid pair. Code should run and print [0, 1] and [1, 2].",
      },
      {
        axis: "Stacks",
        prompt:
          "Given a string containing only the characters ( ) [ ] { }, return whether it is valid: every opening bracket is closed by the same type of bracket, in the correct order. Print the result for \"()[]{}\", \"([)]\" and \"{[]}\", and state the complexity.",
        guidance:
          "Strong: a stack. Push each opener; on a closer, the stack must be non-empty and its top must be the matching opener; at the end the stack must be empty. O(n) time, O(n) space. Expected output: true, false, true. A counter per bracket type is wrong because it accepts \"([)]\". Credit edge cases: empty string (valid), odd length, a closer arriving on an empty stack.",
      },
      {
        axis: "Linked Lists",
        prompt:
          "Define a singly linked list node, build the list 1 -> 2 -> 3 -> 4 -> 5, reverse it in place, and print the list before and after. Then explain how you would detect whether a list contains a cycle, and what extra memory your method needs.",
        guidance:
          "Strong: iterative reversal with prev, current and next pointers, O(n) time and O(1) space; output 1 2 3 4 5 then 5 4 3 2 1. Recursive reversal is fine if its O(n) stack depth is noted. Cycle detection: Floyd's slow and fast pointers, O(n) time and O(1) space; a visited set also works at O(n) space. Credit handling of an empty list and a single node.",
      },
      {
        axis: "Binary Search",
        prompt:
          "You have a sorted array of integers that may contain duplicates. Return the first and last index of a target value, or [-1, -1] if it is absent, in O(log n) time. Print the result for ([5, 7, 7, 8, 8, 10], 8) and ([5, 7, 7, 8, 8, 10], 6).",
        trapClaim:
          "Just use the built-in indexOf and lastIndexOf. They are optimized native functions, so this is effectively O(log n) and you don't need to write a binary search.",
        guidance:
          "The AI claim is wrong: indexOf and lastIndexOf scan linearly, so this is O(n) however fast the native code is. Strong answers say so and run two binary searches: lower bound of the target for the first index, and upper bound minus one (or lower bound of target + 1 minus one) for the last, checking the value actually equals the target. Finding one match and then walking outwards is O(n) when everything is a duplicate. Expected output: [3, 4] and [-1, -1]. Credit correct loop termination and mid computation.",
      },
      {
        axis: "Graph Traversal",
        prompt: [
          "You are given a grid of '1' (land) and '0' (water). An island is a group of land cells connected horizontally or vertically (not diagonally). Count the islands and print the result for this grid, then state the time and space complexity.",
          "",
          "11000",
          "11000",
          "00100",
          "00011",
        ].join("\n"),
        guidance:
          "Strong: scan every cell; on an unvisited land cell, count one island and flood fill it with DFS or BFS, marking cells visited (by changing the grid or with a visited set). Expected output: 3. O(R * C) time; O(R * C) space in the worst case for the visited set, recursion stack or queue. Union find is also acceptable. Credit bounds checks, not treating diagonals as connected, and noting that recursive DFS can overflow the stack on a large grid.",
      },
    ],
  },
];

// Old web-dev sequences. They are moved to the "General" domain, which no interview type can select,
// so recruiters stop seeing them but nothing is deleted. Assessments already built on them will refuse
// new candidates (joinAssessment returns 409); `npm run audit -- --close` closes those assessments.
const RETIRED = ["Full-Stack Web Architecture", "JavaScript Fundamentals", "React Basics", "Web Debugging Scenarios"];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI);

  const retired = await QuestionSequence.updateMany({ name: { $in: RETIRED } }, { $set: { domain: "General" } });
  if (retired.modifiedCount) console.log(`Retired ${retired.modifiedCount} web-dev sequence(s) (domain set to General)`);

  for (const s of sequences) {
    // Upsert will overwrite the old mislabeled database objects with the correct domains
    await QuestionSequence.findOneAndUpdate({ name: s.name }, s, { upsert: true, runValidators: true });
    console.log(`Seeded "${s.name}" (${s.questions.length} stages) [Domain: ${s.domain}]`);
  }
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});