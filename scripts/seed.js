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
    name: "Full-Stack Web Architecture",
    domain: "SDE", // Strictly tags this for SDE
    sourceMaterial: [
      "A Single Page Application (SPA) loads a single HTML document and dynamically updates the content as the user interacts with the app, typically using JavaScript frameworks like React, Angular, or Vue.",
      "Server-Side Rendering (SSR) generates the full HTML for a page on the server in response to navigation. This can improve initial load time and SEO, but increases server load.",
      "A REST API uses standard HTTP methods (GET, POST, PUT, DELETE) to interact with resources identified by URIs. GraphQL is an alternative that allows clients to request exactly the data they need in a single query.",
      "Relational databases (SQL) organize data into tables with predefined schemas and enforce relationships. NoSQL databases (like MongoDB) use flexible schemas, often storing data in JSON-like documents.",
      "Caching temporarily stores copies of data or web pages to serve future requests faster. Common caching layers include CDNs for static assets, Redis for database queries, and browser caching.",
      "Microservices architecture structures an application as a collection of loosely coupled, independently deployable services. Monolithic architecture builds the application as a single, unified unit.",
      "Authentication verifies the identity of a user, often using tokens (like JWT) or sessions. Authorization determines what resources an authenticated user is permitted to access."
    ].join("\n\n"),
    questions: [
      q(
        "You are designing a web application that requires real-time collaborative editing features. How would you choose between using long-polling, Server-Sent Events (SSE), or WebSockets?",
        "WebSockets provide true bidirectional, low-latency communication, ideal for real-time collaborative editing. SSE is unidirectional (server to client) and long-polling is resource-intensive with higher latency. The answer should justify WebSockets based on the bidirectional need."
      ),
      q(
        "A heavily trafficked e-commerce site is experiencing slow page load times due to complex database queries on the product catalog. What caching strategies would you implement to resolve this?",
        "Implement a Redis or Memcached layer to cache the results of frequent, complex database queries. Utilize a CDN to cache static product images and assets. Credit answers that distinguish between data-tier caching and edge caching."
      ),
      q(
        "When transitioning an application from a monolithic architecture to microservices, what are the primary challenges regarding data consistency and how do you address them?",
        "Challenges include distributed transactions and maintaining data integrity across disparate databases. Solutions involve eventual consistency, the Saga pattern, event-driven architectures, and avoiding shared databases between microservices."
      ),
      q(
        "Explain the differences between Server-Side Rendering (SSR) and Client-Side Rendering (CSR). In what scenario would you explicitly choose SSR over CSR?",
        "SSR renders HTML on the server; CSR relies on the browser to execute JavaScript and build the DOM. SSR is preferred for applications where SEO (Search Engine Optimization) and fast initial Time-to-First-Byte (TTFB) are critical, such as public content sites."
      ),
      q(
        "A user logs into your SPA. Describe a secure implementation for handling the authentication token (e.g., JWT) to prevent Cross-Site Scripting (XSS) and Cross-Site Request Forgery (CSRF) attacks.",
        "Store the JWT in an HttpOnly, Secure cookie to mitigate XSS (since JavaScript cannot access it). Implement Anti-CSRF tokens (Synchronizer Token Pattern) or use the SameSite cookie attribute to protect against CSRF attacks."
      ),
    ],
  },
];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI);

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