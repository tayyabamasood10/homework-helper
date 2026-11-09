/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      // Brand palette from the design brief.
      colors: {
        navy: {
          DEFAULT: "#0A1E3F",
          light: "#14315F", // hover / gradient stop
          dark: "#061326",
        },
        gold: {
          DEFAULT: "#FBB017",
          dark: "#E09A08", // hover
          soft: "#FFF4D9", // tinted backgrounds
        },
        lightgray: "#F3F6F9",
      },
      boxShadow: {
        card: "0 20px 50px -12px rgba(10, 30, 63, 0.25)",
      },
    },
  },
  plugins: [],
};
