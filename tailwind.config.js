/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        playfair: ['"Playfair Display"', "Georgia", "Times New Roman", "serif"],
      },
      fontSize: {
        "apple-h1": ["2.5rem", { lineHeight: "1.2" }],
        "apple-h2": ["2rem", { lineHeight: "1.25" }],
        "apple-h3": ["1.4rem", { lineHeight: "1.35" }],
      },
      colors: {
        primary: "#4c7c4c",
        ink: {
          DEFAULT: "#1a1a1a",
          muted: "#6B7280",
          subtle: "#9CA3AF",
          body: "#374151",
        },
      },
      borderRadius: {
        apple: "10px",
        "apple-card": "16px",
      },
      spacing: {
        section: "5.5rem",
      },
    },
  },
  plugins: [],
};
