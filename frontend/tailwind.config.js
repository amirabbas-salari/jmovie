export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Vazirmatn", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#08040d",
        night: "#0d0714",
        plum: "#170d22",
        surface: "#150d1f",
        brand: {
          50: "#fff1f3",
          100: "#ffe0e6",
          200: "#ffc2cf",
          300: "#ff93ab",
          400: "#fb5d82",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
          800: "#8f1230",
          900: "#6d1028",
        },
        gold: "#f5c518",
      },
      boxShadow: {
        glow: "0 14px 44px -12px rgba(244, 63, 94, 0.55)",
        "glow-sm": "0 8px 28px -10px rgba(244, 63, 94, 0.65)",
        card: "0 24px 60px -24px rgba(0, 0, 0, 0.8)",
        glass: "0 18px 50px -20px rgba(0, 0, 0, 0.75)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #fb7185 0%, #e11d48 48%, #9333ea 115%)",
        "brand-soft": "linear-gradient(135deg, rgba(244,63,94,.22), rgba(147,51,234,.16))",
      },
      keyframes: {
        kenBurns: {
          "0%":   { transform: "scale(1.05) translate(0, 0)" },
          "50%":  { transform: "scale(1.18) translate(-1.5%, -1.5%)" },
          "100%": { transform: "scale(1.05) translate(0, 0)" },
        },
        progress: {
          from: { transform: "scaleX(0)" },
          to:   { transform: "scaleX(1)" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to:   { backgroundPosition: "-200% 0" },
        },
        floatY: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "ken-burns": "kenBurns 20s ease-in-out infinite",
        progress: "progress 1s ease-out forwards",
        "fade-up": "fadeUp .7s cubic-bezier(.22,.8,.32,1) both",
        shimmer: "shimmer 1.8s linear infinite",
        "float-y": "floatY 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
