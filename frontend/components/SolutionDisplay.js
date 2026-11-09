"use client";
// components/SolutionDisplay.js
// ---------------------------------------------------------------
// Renders the AI's answer (Markdown-ish text + LaTeX) as a clean card.
//
// SECURITY NOTE
// `react-next-latex` writes non-math text straight into innerHTML and also
// injects the raw math string if KaTeX throws. Because the answer comes from an
// LLM (untrusted), we never hand the library plain text. Instead we:
//   1. split the answer ourselves; plain text is rendered as React text nodes
//      (auto-escaped), and
//   2. pass ONLY validated math snippets to <Latex>, with "<" neutralised and
//      private delimiters that cannot appear inside the math.
// ---------------------------------------------------------------
import { useMemo, useState } from "react";
import katex from "katex";
import { Latex } from "react-next-latex"; // NOTE: named export, not default

// Delimiters made of control characters: they can't occur in real answers
// (we strip them from the math first), so they never clash with the content.
const L = "\u0001";
const R = "\u0002";
const INLINE_DELIMS = [{ left: L, right: R, display: false }];
const DISPLAY_DELIMS = [{ left: L, right: R, display: true }];

const safeTex = (tex) => tex.replace(/[\u0000-\u0008]/g, "").replace(/</g, "\\lt ");

/** One math snippet. Falls back to plain (escaped) text if KaTeX can't parse it. */
function MathSpan({ tex, display }) {
  const safe = useMemo(() => safeTex(tex), [tex]);
  const valid = useMemo(() => {
    try {
      katex.renderToString(safe, { displayMode: display, strict: false, throwOnError: true });
      return true;
    } catch {
      return false;
    }
  }, [safe, display]);

  if (!valid) {
    return <code className="rounded bg-red-50 px-1 text-[0.9em] text-red-700">{tex}</code>;
  }
  return <Latex delimiters={display ? DISPLAY_DELIMS : INLINE_DELIMS}>{L + safe + R}</Latex>;
}

// ---------- inline formatting: math, **bold**, *italic*, `code` ----------

// \( … \)   |   $$ … $$   |   $ … $  (pandoc rules so "$5 and $10" isn't math)
const INLINE_MATH_RE = /\\\(([\s\S]+?)\\\)|\$\$([\s\S]+?)\$\$|(?<!\\)\$(?!\s)([^$\n]*?[^\s$\\])\$(?!\d)/g;
const TOKEN = "";

function renderInline(input, keyPrefix) {
  // 1) Pull math out first so asterisks/underscores inside it are left alone.
  const maths = [];
  const tokenized = input
    .replaceAll(TOKEN, "")
    .replace(INLINE_MATH_RE, (raw, paren, dbl, single) => {
      maths.push({ raw, tex: (paren ?? dbl ?? single).trim(), display: dbl !== undefined });
      return `${TOKEN}${maths.length - 1}${TOKEN}`;
    });

  // 2) Put math back (as <MathSpan>, or as raw text inside `code`).
  const restore = (s, key, asRaw = false) =>
    s.split(new RegExp(`${TOKEN}(\\d+)${TOKEN}`)).map((seg, i) => {
      if (i % 2 === 0) return seg.replace(/\\\$/g, "$"); // "\$" -> "$"
      const m = maths[Number(seg)];
      return asRaw ? m.raw : <MathSpan key={`${key}-m${i}`} tex={m.tex} display={m.display} />;
    });

  // 3) Split on **bold**, *italic*, `code`; everything else is plain text.
  return tokenized
    .split(/(\*\*[^*]+?\*\*|\*[^*\s][^*]*?\*|`[^`]+`)/)
    .filter(Boolean)
    .map((piece, i) => {
      const key = `${keyPrefix}-${i}`;
      if (piece.length > 4 && piece.startsWith("**") && piece.endsWith("**"))
        return <strong key={key} className="font-semibold text-navy">{restore(piece.slice(2, -2), key)}</strong>;
      if (piece.length > 2 && piece.startsWith("*") && piece.endsWith("*"))
        return <em key={key}>{restore(piece.slice(1, -1), key)}</em>;
      if (piece.length > 2 && piece.startsWith("`") && piece.endsWith("`"))
        return (
          <code key={key} className="rounded bg-lightgray px-1.5 py-0.5 text-[0.9em]">
            {restore(piece.slice(1, -1), key, true).join("")}
          </code>
        );
      return <span key={key}>{restore(piece, key)}</span>;
    });
}

// ---------- block-level parsing ----------

/** Split the answer into text / display-math / code blocks. */
function parseBlocks(src) {
  const re = /```[^\n]*\n([\s\S]*?)```|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g; // fresh regex: no shared lastIndex
  const blocks = [];
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    if (m.index > last) blocks.push({ type: "text", value: src.slice(last, m.index) });
    if (m[1] !== undefined) blocks.push({ type: "code", value: m[1].replace(/\n$/, "") });
    else blocks.push({ type: "math", value: (m[2] ?? m[3]).replace(/\s*\n\s*/g, " ").trim() });
    last = m.index + m[0].length;
  }
  if (last < src.length) blocks.push({ type: "text", value: src.slice(last) });
  return blocks;
}

function renderTable(lines, key) {
  const rows = lines.map((l) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())
  );
  const isSeparator = (r) => r.every((c) => /^:?-{2,}:?$/.test(c));
  const [head, ...rest] = rows;
  const body = rest.filter((r) => !isSeparator(r));
  return (
    <div key={key} className="my-4 overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-navy text-white">
          <tr>{head.map((c, i) => <th key={i} className="px-3 py-2 font-semibold">{renderInline(c, `${key}-h${i}`)}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} className={ri % 2 ? "bg-lightgray/60" : "bg-white"}>
              {r.map((c, ci) => <td key={ci} className="px-3 py-2">{renderInline(c, `${key}-r${ri}c${ci}`)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Turn a chunk of Markdown-ish text into headings, lists, tables and paragraphs. */
function renderTextBlock(text, keyBase) {
  const lines = text.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const key = `${keyBase}-${i}`;

    if (!trimmed) { i++; continue; }

    // Table: consecutive lines that start with "|"
    if (trimmed.startsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) tableLines.push(lines[i++]);
      if (tableLines.length >= 2) out.push(renderTable(tableLines, key));
      else out.push(<p key={key}>{renderInline(tableLines[0], key)}</p>);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push(<hr key={key} className="my-5 border-gray-200" />);
      i++; continue;
    }

    // Headings (#, ##, ### …)
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const big = heading[1].length <= 2;
      out.push(
        <h3
          key={key}
          className={`mt-6 border-l-4 border-gold pl-3 font-bold text-navy ${big ? "text-xl" : "text-lg"}`}
        >
          {renderInline(heading[2], key)}
        </h3>
      );
      i++; continue;
    }

    const indent = line.length - line.trimStart().length;
    const marginLeft = Math.min(Math.round(indent / 2), 6) * 10;

    // Numbered list item
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      out.push(
        <div key={key} className="flex gap-3" style={{ marginLeft }}>
          <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-gold px-1.5 text-xs font-bold text-navy">
            {numbered[1]}
          </span>
          <div className="flex-1">{renderInline(numbered[2], key)}</div>
        </div>
      );
      i++; continue;
    }

    // Bullet list item
    const bullet = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      out.push(
        <div key={key} className="flex gap-3" style={{ marginLeft }}>
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
          <div className="flex-1">{renderInline(bullet[1], key)}</div>
        </div>
      );
      i++; continue;
    }

    // Plain paragraph
    out.push(<p key={key}>{renderInline(trimmed, key)}</p>);
    i++;
  }
  return out;
}

// ---------- the card ----------

export default function SolutionDisplay({ solution, loading, error }) {
  const [copied, setCopied] = useState(false);
  const blocks = useMemo(() => (solution ? parseBlocks(solution) : []), [solution]);

  async function copySolution() {
    try {
      await navigator.clipboard.writeText(solution);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be unavailable (e.g. insecure context); ignore */
    }
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8" aria-live="polite">
        <div className="mb-5 flex items-center gap-3">
          <svg className="h-5 w-5 animate-spin text-gold-dark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <p className="font-semibold text-navy">Working through your problem…</p>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-3/4 rounded bg-lightgray" />
          <div className="h-4 w-full rounded bg-lightgray" />
          <div className="h-4 w-5/6 rounded bg-lightgray" />
          <div className="h-16 w-full rounded-xl bg-lightgray" />
          <div className="h-4 w-2/3 rounded bg-lightgray" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
        <p className="font-semibold">Something went wrong</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  if (!solution) return null;

  return (
    <article className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
      <header className="mb-5 flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-navy">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 12 5 5L20 7" />
            </svg>
          </span>
          Step-by-step solution
        </h2>
        <button
          type="button"
          onClick={copySolution}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-navy transition hover:border-gold hover:bg-gold-soft"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </header>

      <div className="space-y-3 text-[15.5px] leading-7 text-gray-800">
        {blocks.map((block, i) => {
          if (block.type === "math") {
            return (
              <div key={i} className="my-4 overflow-x-auto rounded-xl bg-lightgray px-4 py-3 text-center text-lg">
                <MathSpan tex={block.value} display />
              </div>
            );
          }
          if (block.type === "code") {
            return (
              <pre key={i} className="my-3 overflow-x-auto rounded-xl bg-navy p-4 text-sm leading-6 text-gray-100">
                <code>{block.value}</code>
              </pre>
            );
          }
          return <div key={i} className="space-y-3">{renderTextBlock(block.value, `b${i}`)}</div>;
        })}
      </div>

      <p className="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-500">
        AI can make mistakes. Double-check important answers before handing them in.
      </p>
    </article>
  );
}
