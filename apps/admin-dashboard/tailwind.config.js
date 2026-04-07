/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#fef7ee",
          100: "#fdecd3",
          200: "#fad5a5",
          300: "#f6b76d",
          400: "#f19332",
          500: "#ed760e",
          600: "#de5c09",
          700: "#b7440a",
          800: "#92370e",
          900: "#762f0f",
        },
        secondary: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
        "ios-bg": "#F2F2F7",
        ios: {
          primary: "#007AFF",
          success: "#34C759",
          warning: "#FF9500",
          error: "#FF3B30",
          teal: "#30B0C7",
        },
      },
      boxShadow: {
        "ios-sm": "0 2px 8px rgba(0,0,0,0.04)",
        "ios-card": "0 4px 16px rgba(0,0,0,0.06)",
        "ios-float": "0 8px 30px rgba(0,0,0,0.08)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 3s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
