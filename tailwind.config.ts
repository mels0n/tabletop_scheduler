import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

// Tome design tokens. Values live in app/globals.css as RGB channels.
const TOKENS = [
  "ink", "surface", "surface-2", "field", "line", "line-strong",
  "parchment", "parchment-2", "mist",
  "gold", "gold-bright", "on-gold",
  "yes", "yes-bg", "on-yes", "maybe", "maybe-bg", "on-maybe", "no", "no-bg", "on-no",
  "discord", "discord-text", "telegram", "untap", "untap-accent",
] as const;

const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;
const rgb = (name: string) => `rgb(var(--c-${name}))`;

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{ts,tsx}",
    "./entities/**/*.{ts,tsx}",
    "./shared/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: Object.fromEntries(TOKENS.map((t) => [t, token(t)])),
      fontFamily: {
        display: ["var(--font-display, Georgia)", "serif"],
        sans: ["var(--font-text, Georgia)", "serif"],
      },
      // 13px floor for small text: the serif body face thins out at 12px.
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.25rem" }],
      },
      borderRadius: {
        control: "4px",
        card: "6px",
      },
      boxShadow: {
        modal: "0 12px 32px rgb(0 0 0 / 0.45)",
      },
      typography: {
        DEFAULT: {
          css: {
            "--tw-prose-body": rgb("parchment-2"),
            "--tw-prose-headings": rgb("parchment"),
            "--tw-prose-lead": rgb("parchment-2"),
            "--tw-prose-links": rgb("gold"),
            "--tw-prose-bold": rgb("parchment"),
            "--tw-prose-counters": rgb("mist"),
            "--tw-prose-bullets": rgb("gold"),
            "--tw-prose-hr": rgb("line"),
            "--tw-prose-quotes": rgb("parchment"),
            "--tw-prose-quote-borders": rgb("gold"),
            "--tw-prose-captions": rgb("mist"),
            "--tw-prose-code": rgb("parchment"),
            "--tw-prose-pre-code": rgb("parchment-2"),
            "--tw-prose-pre-bg": rgb("field"),
            "--tw-prose-th-borders": rgb("line-strong"),
            "--tw-prose-td-borders": rgb("line"),
            "h1, h2": { fontFamily: "var(--font-display, Georgia), serif", letterSpacing: "0.01em" },
            a: { textUnderlineOffset: "3px" },
            "a:hover": { color: rgb("gold-bright") },
            blockquote: { borderLeftWidth: "2px", fontStyle: "normal" },
            code: { backgroundColor: rgb("surface-2"), borderRadius: "3px", padding: "0.1em 0.35em", fontWeight: "500" },
            "code::before": { content: "none" },
            "code::after": { content: "none" },
          },
        },
      },
    },
  },
  plugins: [typography],
};
export default config;
