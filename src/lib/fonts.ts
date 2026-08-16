import { Noto_Sans_Bengali } from "next/font/google";

// Shared by both root layouts (public `[locale]` and `(dashboard)`), so the
// self-hosted font files are declared once and the two trees emit identical
// CSS variables. next/font requires this call to sit at module scope, which is
// exactly why it lives in its own module rather than inside a layout.
//
// ---------------------------------------------------------------------------
// Why this is the ONLY family
// ---------------------------------------------------------------------------
// Baloo Da 2, Hind Siliguri and Inter used to be declared here as well, sitting
// after var(--font-noto-bengali) in every stack in tailwind.config.ts and
// globals.css. All three were dead weight, for a reason that is invisible in
// the source:
//
// `variable` does not expose one face — it expands to two:
//
//     --font-noto-bengali: 'Noto Sans Bengali', 'Noto Sans Bengali Fallback'
//
// The real face carries unicode-range U+0980-09FE (the whole Bengali block, not
// just digits, so it paints every Bangla glyph). The generated Fallback face
// carries NO unicode-range at all, so it accepts every remaining character —
// Latin letters, ASCII digits, punctuation. Nothing listed after it is ever
// consulted.
//
// Checked in the browser via document.fonts on both / and /en: Baloo, Hind and
// Inter reported `unloaded` — zero glyphs painted — while being preloaded on
// every page. 9 files, 167 KB, fetched at top priority, never drawn. Removing
// them changes no rendered pixel; Latin was already being drawn by the
// metric-matched fallback and still is.
//
// To give Latin a real webfont again, add it BEFORE var(--font-noto-bengali) in
// the stacks. Behind it, any font is unreachable.

// Declared WITHOUT `weight`, which makes next/font ship the variable font: a
// single 105 KB file covering the full 100–900 range, against 186 KB for the
// four static instances it replaces. Fewer bytes AND more weights — the 800 on
// the homepage stat counters is now a real interpolation instead of the browser
// rounding down to the nearest static face.
const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-noto-bengali",
  display: "swap",
});

export const fontVariables = notoBengali.variable;
