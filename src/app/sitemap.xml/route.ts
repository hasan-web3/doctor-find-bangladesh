import { NextResponse } from "next/server";
import { listSitemaps, renderIndexXml } from "@/lib/sitemap-core";

// Root sitemap index at /sitemap.xml — the single URL submitted to Google
// Search Console. Enumerates every shard produced by listSitemaps() so any
// new entity type (added to src/lib/sitemap-core.ts) automatically appears
// without touching this file.

export const revalidate = 3600;

export async function GET() {
  const shards = await listSitemaps().catch(() => [{ section: "core", page: 0 } as const]);
  const body = renderIndexXml(shards);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
