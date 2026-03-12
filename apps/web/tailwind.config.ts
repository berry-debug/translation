import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f1724",
        paper: "#edf2f7",
        coral: "#2563eb",
        mist: "#dbe4ee",
        leaf: "#0f766e"
      },
      borderRadius: {
        "4xl": "1.25rem"
      },
      boxShadow: {
        panel: "0 24px 80px rgba(15, 23, 36, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
