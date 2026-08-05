import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";

// ---------------------------------------------------------------------------
// ROOT LAYOUT for /admin and /admin-login.
// ---------------------------------------------------------------------------
// The second of two root layouts (the other is `src/app/[locale]/layout.tsx`).
// The dashboard is locale-neutral — the middleware never rewrites /admin* into
// a locale segment — so there is no params.locale to read here and the panel is
// Bangla-only, matching the copy the admin screens already ship.
//
// Deliberately minimal: no analytics, no Speed Insights, no preconnect. Those
// exist to measure and accelerate public traffic; loading them for a handful of
// signed-in admins is pure overhead and pollutes the analytics numbers.
//
// Navigating between /admin and a public URL is a full document load rather
// than a client transition. That is the documented trade-off of multiple root
// layouts and is irrelevant here — nobody hops between the two in a session.

// The favicon has to be declared HERE as well as in [locale]/layout.tsx.
//
// It used to be declared once, in the single root layout that covered the whole
// app. Splitting that into two root layouts (public + dashboard) to get the
// locale out of headers() moved the declaration into the public half only, so
// the dashboard silently fell back to the file-convention /icon.svg and the
// admin-uploaded icon stopped appearing on /admin tabs.
//
// Same rule as the public side: point at our OWN /favicon.ico route, which
// proxies the uploaded image, rather than the raw R2 URL — and when nothing has
// been uploaded, omit `icons` entirely so Next falls back to /icon.svg exactly
// as before.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: "ড্যাশবোর্ড",
    // The dashboard must never be indexed, and it is not covered by any
    // public-facing robots rule since it lives outside the [locale] tree.
    robots: { index: false, follow: false },
    ...(settings.favicon_url
      ? { icons: { icon: "/favicon.ico", shortcut: "/favicon.ico", apple: "/favicon.ico" } }
      : {}),
  };
}

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={fontVariables}>
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
