import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        rumbo: {
          bg: "#F7F8FA",
          surface: "#FFFFFF",
          ink: "#0B1220",
          muted: "#6B7280",
          line: "#EEF0F4",
          green: "#16A34A",
          greenSoft: "#DCFCE7",
          violet: "#7C3AED",
          violetSoft: "#EDE9FE",
          blue: "#2563EB",
          blueSoft: "#DBEAFE",
          yellow: "#D97706",
          yellowSoft: "#FEF3C7",
          rose: "#E11D48",
          roseSoft: "#FFE4E6",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
        "3xl": "28px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.10)",
        soft: "0 1px 2px rgba(15,23,42,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
