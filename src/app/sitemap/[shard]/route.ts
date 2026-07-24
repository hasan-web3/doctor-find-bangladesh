import { NextResponse } from "next/server";
import { buildShard, decodeShardId, renderUrlsetXml } from "@/lib/sitemap-core";

// Sub-sitemap shards at /sitemap/<shard>.xml — e.g. /sitemap/doctors.xml,
// /sitemap/specialty-area-3.xml. The [shard] param captures both the raw
// segment (with or without .xml suffix) and passes it to decodeShardId,
// which handles either shape.

export const revalidate = 3600;

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
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
