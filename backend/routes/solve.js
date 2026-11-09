// routes/solve.js
// ---------------------------------------------------------------
// POST /api/solve   (multipart/form-data)
//   fields: question (string, optional)
//   file:   image    (image/*, optional, max 15 MB)
// At least one of the two must be present.
//
// Flow: multer -> Gemini -> respond
// ---------------------------------------------------------------
const express = require("express");
const multer = require("multer");

const { solveHomework } = require("../services/gemini");

const router = express.Router();

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const MAX_QUESTION_LENGTH = 8000;

// Keep the upload in RAM (no temp files on disk).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only image uploads are allowed."));
  },
});

// Wrap multer so its errors become clean JSON responses instead of a stack trace.
function handleUpload(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "Image is too large (15 MB max)." });
    }
    return res.status(400).json({ error: err.message || "Upload failed." });
  });
}

// Map upstream (Gemini) failures to friendly messages + sensible status codes.
function describeAiError(err) {
  const status = err?.status || err?.code;
  if (status === 429) return { code: 429, message: "The AI is busy right now (rate limit). Please try again in a moment." };
  if (status === 503) return { code: 503, message: "The AI service is overloaded. Please try again shortly." };
  if (status === 400) return { code: 400, message: "The AI could not process that input. Try a clearer image or rephrase the question." };
  if (status === 401 || status === 403) return { code: 500, message: "The server's AI credentials are invalid. Check backend/.env." };
  return { code: 500, message: err?.message || "Something went wrong while solving." };
}

router.post("/", handleUpload, async (req, res) => {
  const question = (req.body?.question || "").trim();
  const file = req.file; // undefined when no image was sent

  // 1. Validate: need text, image, or both.
  if (!question && !file) {
    return res.status(400).json({ error: "Please type a question or upload an image." });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: `Question is too long (max ${MAX_QUESTION_LENGTH} characters).` });
  }

  // 2. Ask Gemini. If this fails there is nothing to return, so respond with an error.
  let solution;
  try {
    solution = await solveHomework({
      text: question,
      imageBuffer: file?.buffer,
      mimeType: file?.mimetype,
    });
  } catch (err) {
    console.error("[solve] Gemini error:", err);
    const { code, message } = describeAiError(err);
    return res.status(code).json({ error: message });
  }

  // 3. Respond.
  return res.json({ solution });
});

module.exports = router;