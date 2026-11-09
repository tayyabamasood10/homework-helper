"use client";
// app/page.js

// Landing page: hero + input card + solution + stats bar.
//

import { useRef, useState } from "react";
import axios from "axios";
import QuestionInput from "@/components/QuestionInput";
import SolutionDisplay from "@/components/SolutionDisplay";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Facts about the app itself (not marketing numbers).
const STATS = [
  { value: "Gemini", label: "Flash AI engine" },
  { value: "3 ways", label: "Text, image, or both" },
  { value: "15 MB", label: "Max image size" },
  { value: "0", label: "Sign-ups needed" },
];

const STEPS = [
  { n: "1", title: "Ask", text: "Type your question, or paste / upload a photo of the problem." },
  { n: "2", title: "Generate", text: "Hit Generate and the AI works through it step by step." },
  { n: "3", title: "Learn", text: "Follow the explanation, with clean math formulas, and copy it." },
];

export default function HomePage() {
  const [solution, setSolution] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resultRef = useRef(null);

  async function handleSubmit({ question, image }) {
    setLoading(true);
    setError("");
    setSolution("");

    // Let the loading skeleton scroll into view.
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

    try {
      // multipart/form-data: the (already compressed) image goes straight to Express.
      const formData = new FormData();
      if (question) formData.append("question", question);
      if (image) formData.append("image", image, image.name);

      // Don't set Content-Type manually: the browser adds the multipart boundary.
      const { data } = await axios.post(`${API_URL}/api/solve`, formData, { timeout: 90_000 });
      setSolution(data.solution);
    } catch (err) {
      if (err.code === "ECONNABORTED") {
        setError("The request timed out. Please try again.");
      } else if (err.response) {
        setError(err.response.data?.error || `Server error (${err.response.status}).`);
      } else {
        setError("Can't reach the server. Is the backend running?");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      {/* ---------- Hero ---------- */}
      <section className="bg-gradient-to-b from-navy to-navy-light px-4 pb-36 pt-16 text-center text-white sm:pt-20">
        <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
          AI-powered study help
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Stuck on homework? Get the <span className="text-gold">step-by-step</span> answer.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-white/75 sm:text-lg">
          Type your question or snap a photo. Get a clear explanation with every step shown.
        </p>
      </section>

      {/* ---------- Input card (overlaps the hero) + solution ---------- */}
      <section id="solver" className="relative mx-auto -mt-28 max-w-3xl scroll-mt-20 px-4 sm:px-6">
        <QuestionInput onSubmit={handleSubmit} loading={loading} />

        <div ref={resultRef} className="mt-6 scroll-mt-20">
          <SolutionDisplay solution={solution} loading={loading} error={error} />
        </div>
      </section>

      {/* ---------- Stats bar ---------- */}
      <section id="stats" className="mx-auto mt-16 max-w-6xl scroll-mt-20 px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-gray-200 shadow-sm lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white px-4 py-6 text-center">
              <p className="text-2xl font-extrabold text-navy sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-navy sm:text-3xl">How it works</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl bg-white p-6 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-lg font-extrabold text-navy">
                {s.n}
              </span>
              <h3 className="mt-4 text-lg font-bold text-navy">{s.title}</h3>
              <p className="mt-1 text-sm leading-6 text-gray-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-navy py-6 text-center text-sm text-white/60">
        Homework Helper 
      </footer>
    </main>
  );
}
