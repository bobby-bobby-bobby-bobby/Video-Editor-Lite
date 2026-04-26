/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Custom editor color palette
        editor: {
          bg: "#1a1a2e",
          surface: "#16213e",
          panel: "#0f3460",
          accent: "#e94560",
          text: "#e0e0e0",
          muted: "#888888",
          border: "#2a2a4a",
        },
      },
    },
  },
  plugins: [],
};
