/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Cores baseadas nos tokens c2finance
      colors: {
        // Primary: Teal/Cyan - Estados ativos, destaques
        primary: {
          50: "#ECFEFF",
          100: "#CFFAFE",
          200: "#A5F3FC",
          300: "#67E8F9",
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
          700: "#0E7490",
          800: "#155E75",
          900: "#164E63",
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // Secondary: Indigo/Violet - Elementos de IA/Advisor
        secondary: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        // Gray: Neutros com viés azul-marinho
        gray: {
          0: "#FFFFFF",
          25: "#FBFCFE",
          50: "#F5F7FA",
          100: "#E9EEF5",
          200: "#CBD5E1",
          300: "#A7B3C4",
          400: "#7A889E",
          500: "#55647A",
          600: "#3B4658",
          700: "#253042",
          800: "#141B2A",
          850: "#0F1624",
          900: "#0B1220",
          950: "#070C16",
        },
        // Cores semânticas de acento
        success: "#22C55E",
        danger: "#EF4444",
        warning: "#F59E0B",
        info: "#38BDF8",
        // Cores para valores financeiros
        positive: "hsl(var(--positive))",
        negative: "hsl(var(--negative))",
        neutral: "hsl(var(--neutral))",
        // shadcn/ui semantic tokens
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Sidebar tokens
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
        // Chart tokens
        chart: {
          income: "hsl(var(--chart-income))",
          "income-projected": "hsl(var(--chart-income-projected))",
          expense: "hsl(var(--chart-expense))",
          "expense-projected": "hsl(var(--chart-expense-projected))",
          balance: "hsl(var(--chart-balance))",
        },
      },
      // Border radius baseado nos tokens
      borderRadius: {
        page: "16px",
        panel: "16px",
        card: "16px",
        chip: "999px",
        input: "12px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Spacing baseado nos tokens
      spacing: {
        "page-padding": "24px",
        "sidebar-padding": "18px",
        "card-padding": "18px",
        "grid-gap": "18px",
        tight: "10px",
        "row-height": "44px",
        // Sidebar width
        sidebar: "280px",
        "sidebar-icon": "3rem",
      },
      // Typography
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "page-title": ["28px", { lineHeight: "34px", fontWeight: "700" }],
        "page-subtitle": ["14px", { lineHeight: "20px", fontWeight: "450" }],
        "card-title": ["12px", { lineHeight: "16px", fontWeight: "600", letterSpacing: "0.2px" }],
        "metric-value": ["24px", { lineHeight: "30px", fontWeight: "750" }],
        body: ["12px", { lineHeight: "18px", fontWeight: "450" }],
        muted: ["11px", { lineHeight: "16px", fontWeight: "450" }],
        chip: ["11px", { lineHeight: "14px", fontWeight: "600" }],
      },
      // Box shadows
      boxShadow: {
        panel: "0 18px 55px rgba(0,0,0,0.45)",
        card: "0 14px 40px rgba(0,0,0,0.35)",
        "input-inset": "inset 0 1px 0 rgba(255,255,255,0.04)",
        "focus-teal": "0 0 0 3px rgba(6,182,212,0.22)",
        "focus-ai": "0 0 0 3px rgba(99,102,241,0.22)",
        "glow-teal": "0 0 40px rgba(6,182,212,0.30)",
        "glow-ai": "0 0 40px rgba(99,102,241,0.30)",
      },
      // Animations
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          from: { opacity: "0", transform: "translateX(-20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        slideInUp: {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.05)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 5px rgba(6,182,212,0.2)" },
          "50%": { boxShadow: "0 0 20px rgba(6,182,212,0.4), 0 0 30px rgba(6,182,212,0.2)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
        "slide-in-left": "slideInLeft 0.6s ease-out forwards",
        "slide-in-right": "slideInRight 0.6s ease-out forwards",
        "slide-in-up": "slideInUp 0.6s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 8s ease-in-out infinite",
        "float-fast": "float 4s ease-in-out infinite",
        "pulse-soft": "pulseSoft 3s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite",
        glow: "glow 3s ease-in-out infinite",
      },
      // Backdrop blur
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
};
