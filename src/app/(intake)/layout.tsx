import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";

// ---------------------------------------------------------------------------
// ROOT LAYOUT for /doctor-form/<token>.
// ---------------------------------------------------------------------------
// The third root layout, alongside `src/app/[locale]/layout.tsx` (public) and
// `src/app/(dashboard)/layout.tsx` (admin).
//
// Why its own root rather than living under [locale]: this page is a private,
// token-gated form sent to one doctor. It has no Bangla/English twin to keep in
// sync, no navbar, no footer, no geo prompt and no analytics — it is a single
// task on a single URL. Putting it under the public tree would give it the whole
// site chrome plus a locale segment it has no use for, and would pull it into
// the sitemap-adjacent surface we spend real effort keeping clean.
//
// The middleware skips /doctor-form in its NEUTRAL list, so the locale rewrite
// never touches these URLs.

export const metadata: Metadata = {
  title: "ডাক্তারের তথ্য ফর্ম",
  // Belt and braces with robots.txt: the URL contains a one-time token, so it
  // must never be indexed, followed, cached or snippeted anywhere.
  robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true },
};

export default async function IntakeRootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <html lang="bn" className={fontVariables}>
      <head>
        {settings.favicon_url && <link rel="icon" href="/favicon.ico" />}
      </head>
      <body suppressHydrationWarning={true} className="bg-page">
        {children}
      </body>
    </html>
  );
}
