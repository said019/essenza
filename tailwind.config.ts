import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        heading: ["var(--font-heading)", "serif"],
        headline: ["'Noto Serif'", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        label: ["'Manrope'", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
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
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        essenza: {
          gold: "#AF8B3B",
          goldLight: "#d1b16b",
          goldDim: "#eac16b",
          surface: "#fbf9f6",
          surfaceLow: "#f5f3f0",
          surfaceHigh: "#eae8e5",
          surfaceVariant: "#e4e2df",
          onSurface: "#1b1c1a",
          onSurfaceVariant: "#4e4638",
          secondary: "#5f5e5e",
          outline: "#7f7666",
          outlineVariant: "#d1c5b2",
          // Flow-inspired colors
          flow: "#9bb5cc",
          flowLight: "#c4d5e3",
          flowDeep: "#6e8fa8",
          sage: "#8fae94",
          sageLight: "#bccfbf",
          cream: "#f8f4ed",
          warmWhite: "#fefcf8",
        },
        "on-surface": "#1b1c1a",
        "on-surface-variant": "#4e4638",
        "surface-variant": "#e4e2df",
        "surface-container-low": "#f5f3f0",
        "surface-container": "#efeeeb",
        "surface-container-high": "#eae8e5",
        "surface-container-highest": "#e4e2df",
        "primary-fixed": "#ffdfa0",
        "primary-fixed-dim": "#eac16b",
        "on-primary-fixed": "#261a00",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        flowGradient: {
          "0%": { backgroundPosition: "0% 50%" },
          "25%": { backgroundPosition: "50% 100%" },
          "50%": { backgroundPosition: "100% 50%" },
          "75%": { backgroundPosition: "50% 0%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.6" },
          "50%": { transform: "scale(1.08)", opacity: "0.9" },
        },
        drift: {
          "0%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(30px, -20px) scale(1.05)" },
          "50%": { transform: "translate(-20px, 20px) scale(0.95)" },
          "75%": { transform: "translate(10px, -30px) scale(1.03)" },
          "100%": { transform: "translate(0, 0) scale(1)" },
        },
        wavePulse: {
          "0%, 100%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(1.15)" },
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 3s ease-in-out infinite",
        "flow-gradient": "flowGradient 15s ease infinite",
        breathe: "breathe 6s ease-in-out infinite",
        drift: "drift 20s ease-in-out infinite",
        "drift-slow": "drift 30s ease-in-out infinite",
        "wave-pulse": "wavePulse 8s ease-in-out infinite",
        "float-slow": "floatSlow 8s ease-in-out infinite",
        "float-medium": "floatSlow 5s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
