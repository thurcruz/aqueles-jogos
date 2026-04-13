import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        roxo: {
          DEFAULT: "#5B1FA8",
          escuro: "#3A0F80",
          claro: "#7C3AED",
          hover: "#6D28D9",
        },
        amarelo: {
          DEFAULT: "#FFD600",
          hover: "#F5C800",
        },
        verde: "#22C55E",
        vermelho: "#EF4444",
      },
      fontFamily: {
        pixel: ["var(--font-press-start)", "monospace"],
        corpo: ["var(--font-nunito)", "sans-serif"],
      },
      backgroundImage: {
        "dots-pattern":
          "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
      },
      backgroundSize: {
        "dots-sm": "20px 20px",
      },
      boxShadow: {
        brutal: "4px 4px 0 #3A0F80",
        "brutal-sm": "2px 2px 0 #3A0F80",
        "brutal-amarelo": "4px 4px 0 #F5C800",
        "brutal-lg": "6px 6px 0 #3A0F80",
      },
      keyframes: {
        "pulse-scale": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
        "flash-green": {
          "0%, 100%": { backgroundColor: "white" },
          "50%": { backgroundColor: "#22C55E" },
        },
      },
      animation: {
        "pulse-scale": "pulse-scale 2s ease-in-out infinite",
        "slide-up": "slide-up 0.3s ease-out forwards",
        wiggle: "wiggle 0.5s ease-in-out",
        "flash-green": "flash-green 0.6s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
