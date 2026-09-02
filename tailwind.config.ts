import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F1F0EA",
        surface: "#E8E6DC",
        ink: "#23281F",
        "ink-muted": "#5C6156",
        moss: "#4B5D45",
        "moss-hover": "#3A4936",
        brass: "#B8863B",
        brick: "#A6483A",
        rule: "#D8D4C6",
        "rule-strong": "#C3BEAC",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
