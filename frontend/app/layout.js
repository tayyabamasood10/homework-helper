// app/layout.js
import "./globals.css";
import "katex/dist/katex.min.css"; // required so KaTeX math renders correctly
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Homework Helper | Step-by-step AI solutions",
  description:
    "Type a question or snap a photo of your homework and get a clear, step-by-step solution in seconds.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <Navbar />
        <div id="top">{children}</div>
      </body>
    </html>
  );
}