/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
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
      colors: {
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        canvas: "hsl(var(--canvas))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          emphasis: "hsl(var(--primary-emphasis))",
          wash: "hsl(var(--primary-wash))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // Stripe-style soft, layered elevation (#3c4257 shadow ink)
        xs: "0 1px 2px 0 rgba(60,66,87,0.06)",
        sm: "0 1px 2px 0 rgba(60,66,87,0.06), 0 1px 3px 0 rgba(60,66,87,0.04)",
        DEFAULT: "0 2px 5px -1px rgba(60,66,87,0.08), 0 1px 3px -1px rgba(0,0,0,0.04)",
        md: "0 4px 12px -2px rgba(60,66,87,0.10), 0 2px 4px -2px rgba(0,0,0,0.04)",
        lg: "0 7px 14px 0 rgba(60,66,87,0.10), 0 3px 6px 0 rgba(0,0,0,0.06)",
        xl: "0 15px 35px -5px rgba(60,66,87,0.14), 0 5px 15px -5px rgba(0,0,0,0.08)",
        ring: "0 0 0 1px rgba(60,66,87,0.06)",
        focus: "0 0 0 3px hsl(var(--ring) / 0.32)",
      },
      keyframes: {
        "in-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "in-up": "in-up 0.32s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
