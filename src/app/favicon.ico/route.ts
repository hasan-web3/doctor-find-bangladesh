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

// Long enough that repeat hits are cheap, short enough that an admin who
// swaps the logo sees it the same session. Google caches favicons for weeks
// regardless, so there is nothing to gain from a longer window here.
export const revalidate = 300;

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
      headers: { "Content-Type": mime || "image/png", "Cache-Control": "public, max-age=0, s-maxage=300" },
    });
  }

  try {
    const upstream = await fetch(src, { cache: "no-store" });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        // Pass the real type through. Google and browsers both trust
        // Content-Type over the .ico extension, so a PNG served here is fine.
        "Content-Type": upstream.headers.get("content-type") || "image/png",
        "Cache-Control": "public, max-age=0, s-maxage=300",
      },
    });
  } catch {
    return fallback();
  }
}
