import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        panel: "#111827",
        ink: "#e5e7eb",
        steel: "#334155",
        cyanline: "#22d3ee",
        amberline: "#f59e0b"
      }
    }
  },
  plugins: []
};

export default config;
