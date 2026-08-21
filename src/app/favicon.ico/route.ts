import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/seo-utils";

// Serves the admin-uploaded favicon from OUR OWN origin at /favicon.ico.
//
// Why this route exists at all: the favicon is stored in Cloudflare R2 and the
// <link rel="icon"> used to point straight at pub-*.r2.dev. Browsers happily
// fetch that cross-origin, which is why the tab icon always looked right — but
// Google is far pickier about favicons:
//
//   * it probes /favicon.ico at the site root first, and ours returned 404;
//   * pub-*.r2.dev is Cloudflare's DEVELOPMENT endpoint — documented as
//     rate-limited and not for production — so Googlebot can get throttled
//     on the one request that decides your search-result icon.
//
// Proxying the bytes through our own domain fixes both without giving up the
// admin's ability to change the favicon: the image still lives in R2, but
// Google only ever sees a stable, first-party URL.
//
// Route handlers in a dotted folder are an established pattern in this app —
// see src/app/sitemap.xml/route.ts. Note middleware never touches this path:
// its matcher excludes favicon.ico outright, so no locale rewrite interferes.

// ---------------------------------------------------------------------------
// Freshness is EVENT-driven, not timer-driven
// ---------------------------------------------------------------------------
// This used to be `revalidate = 300` plus a hand-written `s-maxage=300`. Two
// problems with that pair:
//
//   1. A manual Cache-Control opts a route OUT of the ISR cache entirely (the
//      same trap documented at length in src/app/sitemap/[shard]/route.ts), so
//      the route was permanently dynamic. Every 5 minutes, for a file that
//      changes maybe once a year, this woke a function that read site settings
//      from the DB and re-downloaded the image from R2 — and /favicon.ico is
//      requested by Googlebot and by every browser tab on the site.
//   2. Five minutes was never the right number anyway. The admin does not want
//      the icon polled; they want it to change the moment they upload a new one.
//
// So: no manual header (Next now emits its own purgeable ISR headers), and the
// purge is wired to the event that can actually change the answer —
// revalidateFavicon() in src/lib/revalidate.ts fires on every settings save.
// The number below is only a safety ceiling for the case where that purge never
// runs at all, e.g. this entry was first built while the DB or R2 was briefly
// unreachable and cached the fallback. One day bounds that; in normal operation
// the timer never decides anything.
export const revalidate = 86400;

// Every failure path lands on the file-based icon that ships with the app, so
// /favicon.ico is never a dead end for a crawler.
const fallback = () => NextResponse.redirect(siteUrl("/icon.svg"), 307);

export async function GET() {
  let src = "";
  try {
    src = (await getSettings()).favicon_url?.trim() ?? "";
  } catch {
    // Settings unreachable — fall through to the bundled icon below.
  }

  // No favicon configured, or a setting that points back here (which would
  // recurse until the function times out).
  if (!src || /^\/?favicon\.ico$/i.test(src)) return fallback();

  // The admin form holds a data: URL before upload; decode it directly rather
  // than trying to fetch it.
  const dataUrl = src.match(/^data:([^;,]+)(;base64)?,(.*)$/is);
  if (dataUrl) {
    const [, mime, isB64, payload] = dataUrl;
    const body = isB64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
    return new NextResponse(new Uint8Array(body), {
      headers: { "Content-Type": mime || "image/png" },
    });
  }

  try {
    // Deliberately NOT `cache: "no-store"`. A no-store fetch forces the whole
    // route handler to be dynamic, which would silently undo the ISR caching
    // declared above and put us straight back to re-downloading this image on
    // every request. Tagging it "settings" instead means the admin's own save
    // is what invalidates it — the same event that purges the route itself.
    const upstream = await fetch(src, { next: { revalidate, tags: ["settings"] } });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        // Pass the real type through. Google and browsers both trust
        // Content-Type over the .ico extension, so a PNG served here is fine.
        "Content-Type": upstream.headers.get("content-type") || "image/png",
      },
    });
  } catch {
    return fallback();
  }
}
