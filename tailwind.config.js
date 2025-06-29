/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "claude-blue": "#1f2937",
        "claude-blue-light": "#374151",
        "claude-orange": "#f97316",
        gray: {
          850: "#1a202e",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
