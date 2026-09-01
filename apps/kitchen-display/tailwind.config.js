import { iosColors, iosShadows } from "../../design-tokens.js";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ...iosColors,
      },
      boxShadow: {
        ...iosShadows,
        "card-sm": "0 2px 8px rgba(0, 0, 0, 0.04)",
        card: "0 4px 16px rgba(0, 0, 0, 0.06)",
        "card-lg": "0 8px 30px rgba(0, 0, 0, 0.08)",
      },
      borderRadius: {
        ios: "20px",
        "ios-lg": "24px",
      },
      fontSize: {
        "kitchen-stats": ["2rem", { lineHeight: "1.2", fontWeight: "800" }],
        "kitchen-order": ["1.375rem", { lineHeight: "1.3", fontWeight: "800" }],
        "kitchen-table": ["1.125rem", { lineHeight: "1.3", fontWeight: "700" }],
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
        128: "32rem",
      },
      keyframes: {
        "urgent-pulse": {
          "0%, 100%": { backgroundColor: "#FFF5F5" },
          "50%": { backgroundColor: "#FFEBEE" },
        },
      },
      animation: {
        "urgent-pulse": "urgent-pulse 2s ease-in-out infinite",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};
