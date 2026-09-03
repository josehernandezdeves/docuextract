import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f6fb",
          100: "#e3ecf7",
          200: "#c2d6ec",
          300: "#93b6db",
          400: "#5c8fc4",
          500: "#3970a9",
          600: "#2a578c",
          700: "#234771",
          800: "#1f3c5e",
          900: "#1c344f",
          950: "#0f1d2e",
        },
        ink: {
          50: "#f7f8fa",
          100: "#eceef2",
          200: "#d5d9e0",
          300: "#aeb6c2",
          400: "#818da0",
          500: "#616f85",
          600: "#4c586d",
          700: "#3e475a",
          800: "#2c3342",
          900: "#1a1f29",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(15, 29, 46, 0.06), 0 1px 3px 0 rgba(15, 29, 46, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
