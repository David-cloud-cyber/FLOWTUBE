import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter Tight", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"]
      },
      colors: {
        ink: "#08080A",
        panel: "#101012",
        panel2: "#151517",
        lime: "#D7F94B",
        muted: "#9A9A9C"
      },
      boxShadow: {
        lime: "0 0 24px -8px #D7F94B"
      }
    }
  },
  plugins: []
} satisfies Config;
