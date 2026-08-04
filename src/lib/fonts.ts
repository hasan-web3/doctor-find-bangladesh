import { Baloo_Da_2, Hind_Siliguri, Inter, Noto_Sans_Bengali } from "next/font/google";

// Shared by both root layouts (public `[locale]` and `(dashboard)`), so the
// self-hosted font files are declared once and the two trees emit identical
// CSS variables. next/font requires these calls to sit at module scope, which
// is exactly why they live in their own module rather than inside a layout.

const baloo = Baloo_Da_2({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

const hind = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-hind",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Noto Sans Bengali is used only to render Bangla digits (০–৯) crisply — it
// sits first in every font stack, and other Bangla glyphs fall through to
// Baloo / Hind. Self-hosting via next/font kills the render-blocking Google
// Fonts @import chain that used to live at the top of globals.css.
const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-bengali",
  display: "swap",
});

export const fontVariables = `${baloo.variable} ${hind.variable} ${inter.variable} ${notoBengali.variable}`;
