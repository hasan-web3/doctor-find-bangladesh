import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F0FDFA",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          500: "#14B8A6",
          // 600 darkened from #0D9488 to reach WCAG AA 4.5:1 with white for
          // buttons/badges. Original teal-600 fails contrast at 15.5px bold.
          600: "#0B7F75",
          700: "#0F766E",
          900: "#134E4A",
        },
        ink: {
          DEFAULT: "#0F172A",
          soft: "#334155",
          mute: "#475569",
          faint: "#64748B",
          ghost: "#94A3B8",
        },
        line: "#E2E8F0",
        page: "#F8FAFC",
        accent: {
          DEFAULT: "#22C55E",
          hover: "#16A34A",
          soft: "#ECFDF5",
          text: "#059669",
        },
        warm: {
          DEFAULT: "#F97316",
          soft: "#FFF7ED",
          border: "#FED7AA",
          text: "#EA580C",
          deep: "#C2410C",
          heavy: "#9A3412",
        },
      },
      fontFamily: {
        // "Noto Sans Bengali" is subset-loaded with only ০–৯ digits in
        // globals.css, so the browser uses it purely for those code points
        // and falls through to Baloo/Hind/Inter for every other character.
        heading: ['"Noto Sans Bengali"', "var(--font-baloo)", "cursive"],
        body: ['"Noto Sans Bengali"', "var(--font-hind)", "sans-serif"],
        latin: ['"Noto Sans Bengali"', "var(--font-inter)", "sans-serif"],
      },
      maxWidth: { site: "1400px" },
      typography: ({ theme }: { theme: (path: string) => string }) => ({
        bn: {
          css: {
            "--tw-prose-body": theme("colors.ink.mute"),
            "--tw-prose-headings": theme("colors.ink.soft"),
            "--tw-prose-lead": theme("colors.ink.mute"),
            "--tw-prose-links": theme("colors.brand[700]"),
            "--tw-prose-bold": theme("colors.ink.soft"),
            "--tw-prose-counters": theme("colors.ink.mute"),
            "--tw-prose-bullets": theme("colors.brand[600]"),
            "--tw-prose-hr": theme("colors.line"),
            "--tw-prose-quotes": theme("colors.ink.soft"),
            "--tw-prose-quote-borders": theme("colors.brand[300]"),
            "--tw-prose-captions": theme("colors.ink.faint"),
            "--tw-prose-code": theme("colors.brand[700]"),
            "--tw-prose-pre-code": theme("colors.brand[50]"),
            "--tw-prose-pre-bg": theme("colors.brand[900]"),
            "--tw-prose-invert-body": theme("colors.slate[300]"),
            "--tw-prose-invert-headings": theme("colors.white"),
            "--tw-prose-invert-lead": theme("colors.slate[400]"),
            "--tw-prose-invert-links": theme("colors.white"),
            "--tw-prose-invert-bold": theme("colors.white"),
            "--tw-prose-invert-counters": theme("colors.slate[400]"),
            "--tw-prose-invert-bullets": theme("colors.slate[400]"),
            "--tw-prose-invert-hr": theme("colors.slate[700]"),
            "--tw-prose-invert-quotes": theme("colors.slate[100]"),
            "--tw-prose-invert-quote-borders": theme("colors.slate[700]"),
            "--tw-prose-invert-captions": theme("colors.slate[400]"),
            "--tw-prose-invert-code": theme("colors.white"),
            "--tw-prose-invert-pre-code": theme("colors.slate[300]"),
            "--tw-prose-invert-pre-bg": "rgb(0 0 0 / 50%)",
            "fontFamily": '"Noto Sans Bengali", var(--font-hind), sans-serif',
            "h2, h3, h4": {
              fontFamily: '"Noto Sans Bengali", var(--font-baloo), cursive',
            },
            "ul > li::marker": {
              //fontSize: "1.2em",
            },
          },
        },
      }),
      keyframes: {
        fadeup: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadein: { from: { opacity: "0" }, to: { opacity: "1" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "content-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeup: "fadeup .6s ease both",
        fadein: "fadein .5s ease both",
        "content-in": "content-in 0.5s ease-out both",
      },
      boxShadow: {
        card: "0 4px 20px rgba(15,23,42,0.06)",
        cardhover: "0 12px 28px rgba(15,23,42,0.10)",
        pop: "0 10px 30px rgba(15,23,42,0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;
