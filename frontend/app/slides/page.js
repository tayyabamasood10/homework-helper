"use client";
// app/slides/page.js: AI Slide Generator
import { useState } from "react";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Build and download a .pptx from the slide JSON.
async function downloadPptx(slides, topic) {
  // Loaded on click only, so pptxgenjs never runs during server rendering.
  const { default: PptxGenJS } = await import("pptxgenjs");

  const NAVY = "0A1E3F";
  const GOLD = "FBB017";

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.title = topic;

  slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };

    // Navy title band with a gold accent bar
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.4, fill: { color: NAVY } });
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 1.4, w: 13.33, h: 0.08, fill: { color: GOLD } });
    slide.addText(s.title, {
      x: 0.6, y: 0.2, w: 12.1, h: 1,
      fontFace: "Calibri", fontSize: 32, bold: true, color: "FFFFFF", valign: "middle", fit: "shrink",
    });

    // Bullets
    if (s.bullets.length) {
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: { code: "25CF" }, breakLine: true } })),
        {
          x: 0.8, y: 1.9, w: 11.7, h: 4.8,
          fontFace: "Calibri", fontSize: 22, color: "1F2937", valign: "top", paraSpaceAfter: 14, fit: "shrink",
        }
      );
    }

    // Slide number
    slide.addText(`${i + 1} / ${slides.length}`, {
      x: 11.8, y: 6.95, w: 1.2, h: 0.35, fontSize: 12, color: "9CA3AF", align: "right",
    });
  });

  const safeName = topic.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 50) || "presentation";
  await pptx.writeFile({ fileName: `${safeName}.pptx` });
}

export default function SlidesPage() {
  const [topic, setTopic] = useState("");
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!topic.trim() || loading) {
      if (!topic.trim()) setError("Enter a topic first.");
      return;
    }
    setLoading(true);
    setError("");
    setSlides([]);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/generate-slides`,
        { topic: topic.trim() },
        { timeout: 90_000 }
      );
      setSlides(data);
    } catch (err) {
      if (err.code === "ECONNABORTED") setError("The request timed out. Please try again.");
      else if (err.response) setError(err.response.data?.error || `Server error (${err.response.status}).`);
      else setError("Can't reach the server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadPptx(slides, topic.trim());
    } catch (err) {
      console.error(err);
      setError("Couldn't create the PPTX file.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main>
      {/* Hero + input */}
      <section className="bg-gradient-to-b from-navy to-navy-light px-4 pb-32 pt-14 text-center text-white">
        <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
          AI Slide Generator
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Turn any topic into a <span className="text-gold">5-slide deck</span>.
        </h1>
      </section>

      <section className="relative mx-auto -mt-24 max-w-3xl px-4 sm:px-6">
        <div className="rounded-2xl bg-white p-5 shadow-card sm:p-7">
          <label htmlFor="topic" className="mb-2 block text-sm font-semibold text-navy">
            Presentation topic
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="topic"
              value={topic}
              maxLength={200}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder="e.g. Photosynthesis, World War II, Climate change"
              className="flex-1 rounded-xl border border-gray-200 bg-lightgray/60 px-4 py-3 text-[15px] text-navy placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-6 py-3 font-bold text-navy transition hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              )}
              {loading ? "Generating…" : "Generate Slides"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </section>

      {/* Preview */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
        {loading && (
          <div className="grid gap-5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-white shadow-sm" />
            ))}
          </div>
        )}

        {slides.length > 0 && (
          <>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-navy">Preview ({slides.length} slides)</h2>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white transition hover:bg-navy-light disabled:opacity-60"
              >
                {downloading ? "Preparing…" : "Download PPTX"}
              </button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {slides.map((s, i) => (
                <article key={i} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  <header className="flex items-center gap-3 border-b-4 border-gold bg-navy px-5 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-extrabold text-navy">
                      {i + 1}
                    </span>
                    <h3 className="font-bold text-white">{s.title}</h3>
                  </header>
                  <ul className="space-y-2 p-5 text-[15px] leading-6 text-gray-800">
                    {s.bullets.map((b, j) => (
                      <li key={j} className="flex gap-3">
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}