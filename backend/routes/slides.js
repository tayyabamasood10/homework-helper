// routes/slides.js
// POST /api/generate-slides   body: { topic: string }
// Returns: [{ title: string, bullets: string[] }, ...]
const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const router = express.Router();
const MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const MAX_TOPIC_LENGTH = 200;

let client;
function getClient() {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set in backend/.env");
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

/** Remove accidental ```json fences, then parse and validate the slide array. */
function parseSlides(raw) {
  let text = (raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Fallback: grab the first [...] block if the model added extra prose.
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end <= start) throw new Error("AI did not return valid JSON.");
    data = JSON.parse(text.slice(start, end + 1));
  }

  if (!Array.isArray(data) || data.length === 0) throw new Error("AI returned no slides.");

  // Keep only well-formed slides and normalise the shape.
  return data
    .filter((s) => s && typeof s.title === "string")
    .map((s) => ({
      title: s.title.trim(),
      bullets: Array.isArray(s.bullets) ? s.bullets.filter((b) => typeof b === "string").map((b) => b.trim()) : [],
    }));
}

router.post("/", async (req, res) => {
  const topic = (req.body?.topic || "").trim();
  if (!topic) return res.status(400).json({ error: "Please enter a topic." });
  if (topic.length > MAX_TOPIC_LENGTH) {
    return res.status(400).json({ error: `Topic is too long (max ${MAX_TOPIC_LENGTH} characters).` });
  }

  const prompt =
    `You are a presentation expert. Create a 5-slide presentation about ${JSON.stringify(topic)}. ` +
    `Return ONLY a valid JSON array. No markdown, no backticks. ` +
    `Format: [{"title": "...", "bullets": ["...", "..."]}]`;

  try {
    const response = await getClient().models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" }, // asks Gemini for raw JSON
    });
    return res.json(parseSlides(response.text));
  } catch (err) {
    console.error("[slides] error:", err);
    const status = err?.status || err?.code;
    if (status === 429) return res.status(429).json({ error: "The AI is busy (rate limit). Try again in a moment." });
    if (status === 503) return res.status(503).json({ error: "The AI is overloaded. Try again shortly." });
    return res.status(500).json({ error: "Couldn't generate slides. Please try again." });
  }
});

module.exports = router;