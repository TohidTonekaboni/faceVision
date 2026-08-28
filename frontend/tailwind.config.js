/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#FFFFFF",
        canvas: "#F6F7FB",
        subtle: "#F1F2F8",
        border: "#E4E7EF",
        primary: "#4F46E5",
        primaryDark: "#4338CA",
        accent: "#0D9488",
        ink: "#1E2233",
        inkDim: "#6B7280",
        success: "#16A34A",
        danger: "#DC2626",
        warning: "#D97706",
      },
      fontFamily: {
        display: ["'Inter'", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(30, 34, 51, 0.04), 0 8px 24px rgba(30, 34, 51, 0.06)",
      },
    },
  },
  plugins: [],
};
