import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "ড্যাশবোর্ড",
  // The dashboard must never be indexed, and it is not covered by any
  // public-facing robots rule since it lives outside the [locale] tree.
  robots: { index: false, follow: false },
};

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={fontVariables}>
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
