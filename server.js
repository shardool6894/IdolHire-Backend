require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const required = ["MONGODB_URI", "JWT_SECRET", "GOOGLE_CLIENT_ID", "CLIENT_ORIGIN"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters.");
  process.exit(1);
}

// Routes are required after the env check because the auth controller reads env at load time.
const authRoutes = require("./routes/auth");
const questionSequenceRoutes = require("./routes/questionSequences");
const assessmentRoutes = require("./routes/assessments");
const attemptRoutes = require("./routes/attempts");
const sandboxRoutes = require("./routes/sandbox");

const PORT = process.env.PORT || 8000;
const isProd = process.env.NODE_ENV === "production";
// Browsers send origins without a trailing slash, so strip it from the env value.
const allowedOrigins = process.env.CLIENT_ORIGIN.split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const app = express();

// Behind a proxy/load balancer (Render, Railway, Nginx...) so rate limiting and
// secure cookies see the real client IP / protocol.
if (isProd) app.set("trust proxy", 1);

// ---------- middleware ----------
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = same-origin request, curl, Postman, health checks: allow.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`CORS blocked origin: ${origin} (allowed: ${allowedOrigins.join(", ")})`);
      callback(null, false); // omit CORS headers; the browser then blocks the response
    },
    credentials: true, // required for the auth cookie to be sent cross-origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// ---------- routes ----------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

app.use("/api/auth", authRoutes);
app.use("/api/question-sequences", questionSequenceRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/attempts", attemptRoutes);
app.use("/api/sandbox", sandboxRoutes);
// ---------- 404 + error handling ----------
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  console.error(err);
  res.status(500).json({ error: isProd ? "Something went wrong" : err.message });
});

// ---------- start ----------
let server;

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");
    server = app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
  } catch (err) {
    console.error("Failed to start:", err.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.close();
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));

start();