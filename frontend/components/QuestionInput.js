"use client";
// components/QuestionInput.js
// ---------------------------------------------------------------
// The white input card. Lets the student:
//   • type a question
//   • pick / drag-drop / PASTE (Ctrl+V) an image
// Images are compressed in the browser BEFORE they are sent to Express.
// The parent receives { question, image } where image is a compressed File.
// ---------------------------------------------------------------
import { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";

const MAX_RAW_BYTES = 30 * 1024 * 1024; // refuse absurdly large originals early

// Compression target: keeps text in photos readable but well under the 15 MB server limit.
const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
};

const formatSize = (bytes) =>
  bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export default function QuestionInput({ onSubmit, loading }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState(null); // compressed File
  const [originalSize, setOriginalSize] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // Create / clean up the object URL used for the thumbnail.
  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  /** Validate + compress an image coming from the picker, drop or clipboard. */
  async function handleImage(rawFile) {
    setError("");
    if (!rawFile.type.startsWith("image/")) {
      setError("That file isn't an image. Please choose a PNG, JPG or WebP.");
      return;
    }
    if (rawFile.size > MAX_RAW_BYTES) {
      setError("That image is too large (30 MB max).");
      return;
    }

    setCompressing(true);
    try {
      const compressed = await imageCompression(rawFile, COMPRESSION_OPTIONS);
      // Make sure the result is a File with a name (pasted images are often just "image.png").
      const name = rawFile.name || "pasted-image.png";
      setImage(new File([compressed], name, { type: compressed.type || rawFile.type }));
      setOriginalSize(rawFile.size);
    } catch (err) {
      console.error("Image compression failed:", err);
      setError("Couldn't process that image. Try a PNG or JPG.");
    } finally {
      setCompressing(false);
    }
  }

  /** Clipboard paste: grab the first image on the clipboard (if any). */
  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault(); // don't also paste a filename into the textarea
          handleImage(file);
          return;
        }
      }
    }
    // No image on the clipboard: let normal text paste happen.
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = Array.from(e.dataTransfer?.files || []).find((f) => f.type.startsWith("image/"));
    if (file) handleImage(file);
    else setError("Drop an image file (PNG, JPG or WebP).");
  }

  function removeImage() {
    setImage(null);
    setOriginalSize(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleGenerate() {
    if (loading || compressing) return;
    if (!text.trim() && !image) {
      setError("Type a question or add an image first.");
      return;
    }
    setError("");
    onSubmit({ question: text.trim(), image });
  }

  const busy = loading || compressing;

  return (
    <div
      // Paste works anywhere inside the card (textarea, dropzone, etc.).
      onPaste={handlePaste}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded-2xl bg-white p-5 shadow-card ring-2 transition sm:p-7 ${
        dragging ? "ring-gold" : "ring-transparent"
      }`}
    >
      {/* Question text */}
      <label htmlFor="question" className="mb-2 block text-sm font-semibold text-navy">
        Your question
      </label>
      <textarea
        id="question"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl/Cmd + Enter submits.
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerate();
        }}
        rows={4}
        placeholder="e.g. Solve for x: 2x² − 5x − 3 = 0"
        className="w-full resize-y rounded-xl border border-gray-200 bg-lightgray/60 p-3.5 text-[15px] text-navy placeholder:text-gray-400 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
      />

      {/* Image area */}
      <div className="mt-4">
        {image && previewUrl ? (
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Your uploaded homework" className="h-20 w-20 rounded-lg object-cover" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium text-navy">{image.name}</p>
              <p className="text-gray-500">
                {formatSize(originalSize)} → {formatSize(image.size)} after compression
              </p>
            </div>
            <button
              type="button"
              onClick={removeImage}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={compressing}
            className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
              dragging ? "border-gold bg-gold-soft" : "border-gray-300 hover:border-gold hover:bg-gold-soft/60"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-gold-dark" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <span className="text-sm font-semibold text-navy">
              {compressing ? "Compressing image…" : "Add a photo of your problem"}
            </span>
            <span className="text-xs text-gray-500">Click to browse, drag &amp; drop, or paste with Ctrl/⌘ + V</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImage(file);
          }}
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Generate */}
      <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-500">Text, image, or both. Press Ctrl/⌘ + Enter to generate.</p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-7 py-3 text-base font-bold text-navy shadow-sm transition hover:bg-gold-dark focus:outline-none focus:ring-2 focus:ring-gold/60 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          )}
          {loading ? "Solving…" : "Generate"}
        </button>
      </div>
    </div>
  );
}
