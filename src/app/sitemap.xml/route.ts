import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/seo-utils";
import { generateSitemaps } from "../sitemap";

// Root sitemap index at /sitemap.xml — the single URL submitted to Google
// Search Console. Next 15's generateSitemaps() emits sub-sitemaps at
// /sitemap/<id>.xml but does NOT auto-generate an index; this route handler
// fills that gap by enumerating every shard the app currently ships.
//
// Rule of thumb going forward: any new entity type added to generateSitemaps()
// (e.g. `reviews`, `videos`) appears here automatically — no edits required.

export const revalidate = 3600; // matches sitemap.ts; also flipped by revalidateTag("sitemap")

function escapeXml(v: string): string {
  return v.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string),
  );
}

export async function GET() {
  const shards = await generateSitemaps().catch(() => [{ id: "core" }]);
  const now = new Date().toISOString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">
${shards
  .map(
    (s) => `  <sitemap>
    <loc>${escapeXml(siteUrl(`/sitemap/${s.id}.xml`))}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`,
  )
  .join("\n")}
</sitemapindex>`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Public CDN cache for one hour; ISR-style refresh on tag revalidation.
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
