/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "claude-blue": "#1f2937",
        "claude-blue-light": "#374151",
        "claude-orange": "#f97316",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
