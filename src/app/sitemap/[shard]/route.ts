import { NextResponse } from "next/server";
import { buildShard, decodeShardId, renderUrlsetXml } from "@/lib/sitemap-core";

// Sub-sitemap shards at /sitemap/<shard>.xml — e.g. /sitemap/doctors.xml,
// /sitemap/specialty-area-3.xml. The [shard] param captures both the raw
// segment (with or without .xml suffix) and passes it to decodeShardId,
// which handles either shape.

// 24h — and the freshness problem this file used to have is solved a different
// way, not by a short window.
//
// HISTORY: this route carried `Cache-Control: s-maxage=60` because
// revalidatePath() cannot evict an edge entry created by a HAND-WRITTEN
// s-maxage. True — but that also meant the route opted out of the ISR cache
// entirely, so every crawler hit re-ran the section queries (a full scan of the
// doctors table plus the coverage CTEs) as a billed function. That is the
// Active-CPU cost this change removes.
//
// The header is gone, so Next emits its OWN ISR cache headers and the entry is
// purgeable again — and revalidateSitemaps() (src/lib/revalidate.ts) already
// runs on EVERY content mutation and calls
// `revalidatePath("/sitemap/[shard]", "page")`, which covers all shards. So a
// newly added doctor still lands in the XML immediately; the 24h number is only
// the ceiling for when nothing changes at all.
//
// Do not reintroduce a manual Cache-Control here — it silently disables both
// the cache and the purge.
export const revalidate = 86400;

// A dynamic segment with no generateStaticParams is treated as fully dynamic —
// `revalidate` alone would not put the response in the incremental cache, and
// every crawler hit would still re-run the section queries. Declaring it (even
// empty) opts the route into ISR: nothing is prerendered at build, but the
// first request for each shard is cached and served from there afterwards.
// `dynamicParams` defaults to true, so unknown/new shards still resolve.
export function generateStaticParams(): { shard: string }[] {
  return [];
}

export async function GET(_req: Request, ctx: { params: Promise<{ shard: string }> }) {
  const { shard } = await ctx.params;
  const id = decodeShardId(shard);
  const entries = await buildShard(id).catch(() => []);
  if (entries.length === 0) {
    // Unknown or empty section — 404 so search engines drop the URL from
    // their crawl queue instead of retrying an empty <urlset>. The sitemap
    // index only lists sections that actually have rows (see listSitemaps()
    // in src/lib/sitemap-core.ts), so this only fires for hand-typed URLs
    // or a section whose rows were deleted between the index request and
    // the shard request.
    return new NextResponse("Not found", { status: 404 });
  }
  const body = renderUrlsetXml(entries);
  return new NextResponse(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
