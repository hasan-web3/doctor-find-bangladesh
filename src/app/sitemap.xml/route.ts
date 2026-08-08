import { NextResponse } from "next/server";
import { listSitemaps, renderIndexXml } from "@/lib/sitemap-core";

// Root sitemap index at /sitemap.xml — the single URL submitted to Google
// Search Console. Enumerates every shard produced by listSitemaps() so any
// new entity type (added to src/lib/sitemap-core.ts) automatically appears
// without touching this file.

// Building this index is the single most expensive request on the site:
// listSitemaps() runs sectionEntries() for ALL eight sections just to count
// them, and several of those are multi-join CTE queries over the whole doctor
// table. Googlebot re-fetches the index constantly, so it must be answered from
// cache, not recomputed. See the shard route for why the cache is a `revalidate`
// window rather than a hand-written Cache-Control header.
export const revalidate = 86400;

export async function GET() {
  const shards = await listSitemaps().catch(() => [{ section: "core", page: 0 } as const]);
  const body = renderIndexXml(shards);
  return new NextResponse(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
