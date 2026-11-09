// services/gemini.js

const { GoogleGenAI } = require("@google/genai");

const MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";


// System prompt required by the spec.
const SYSTEM_PROMPT =
  "Solve this homework problem and provide a detailed, step-by-step explanation. Format math formulas in LaTeX.";

// Used when the student uploads an image but types nothing.
const IMAGE_ONLY_PROMPT =
  "The homework problem is in the attached image. Read it carefully and solve it.";

// Lazily create the client so dotenv has already populated process.env.
let client;
function getClient() {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in backend/.env");
    }
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

/**
 * Ask Gemini to solve a homework problem.
 * @param {object}  input
 * @param {string}  [input.text]   Typed question (optional if image given)
 * @param {Buffer}  [input.imageBuffer]  Raw image bytes (optional if text given)
 * @param {string}  [input.mimeType]     e.g. "image/jpeg"
 * @returns {Promise<string>} The solution text (Markdown + LaTeX)
 */
async function solveHomework({ text, imageBuffer, mimeType }) {
  const hasText = Boolean(text && text.trim());
  const hasImage = Boolean(imageBuffer && imageBuffer.length);

  if (!hasText && !hasImage) {
    throw new Error("Provide a question, an image, or both.");
  }

  // Build the multimodal "parts" array depending on what was sent.
  const parts = [];

  if (hasImage) {
    parts.push({
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: imageBuffer.toString("base64"),
      },
    });
  }

  // Text part: the user's question, or a fallback when only an image is sent.
  parts.push({ text: hasText ? text.trim() : IMAGE_ONLY_PROMPT });

  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: { systemInstruction: SYSTEM_PROMPT },
  });

  const solution = response.text;
  if (!solution || !solution.trim()) {
    // Happens when the response is blocked or empty.
    throw new Error("The AI returned an empty response. Try rephrasing the question.");
  }
  return solution.trim();
}

module.exports = { solveHomework };
