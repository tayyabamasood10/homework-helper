// server.js
// ---------------------------------------------------------------
// Express entry point for the AI Homework Helper API.
// ---------------------------------------------------------------
require("dotenv").config(); // must run before the services read process.env

const express = require("express");
const cors = require("cors");

const solveRouter = require("./routes/solve");
const slidesRouter = require("./routes/slides");

const app = express();
const PORT = process.env.PORT || 5000;

// Allow the Next.js frontend (comma-separated list supported).
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins, methods: ["GET", "POST", "OPTIONS"] }));
app.use(express.json({ limit: "1mb" })); // images arrive as multipart, handled by multer

// Simple health check.
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Main endpoints.
app.use("/api/solve", solveRouter);
app.use("/api/generate-slides", slidesRouter);

// 404 for anything else.
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Last-resort error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Homework Helper API listening on http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) console.warn("⚠  GEMINI_API_KEY is missing (backend/.env)");
});