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
        paypal: {
          blue: "#0070BA",
          darkblue: "#003087",
          lightblue: "#00CFDE",
          yellow: "#FFC439",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
