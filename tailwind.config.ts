import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        canvas: "#0D1117",
        surface: "#161B22",
        "surface-raised": "#21262D",
        "border-muted": "#30363D",
        "border-subtle": "#21262D",
        marine: {
          DEFAULT: "#0070BA",
          dark: "#00457C",
          light: "#009CDE",
        },
        settlement: {
          DEFAULT: "#2EA043",
          dark: "#238636",
          light: "#3FB950",
        },
        caution: {
          DEFAULT: "#D29922",
          dark: "#BB8009",
          light: "#E3B341",
        },
        fault: {
          DEFAULT: "#F85149",
          dark: "#DA3633",
          light: "#FF7B72",
        },
        paypal: {
          blue: "#0070BA",
          darkblue: "#003087",
          lightblue: "#00CFDE",
          yellow: "#FFC439",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
