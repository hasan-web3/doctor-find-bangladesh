import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { db, redirects } from "@/db";

// Redirect map for the middleware's stale-while-revalidate cache.
// Tag-cached (revalidated on every redirect mutation), so this endpoint is a
// cheap in-memory hit after the first call — never a live DB query per request.

// The whole RESPONSE is cached too, not just the query. Middleware refreshes
// its snapshot from here in the background, and Vercel runs many edge isolates,
// so this was being invoked as a serverless function continuously even though
// the body changes a few times a month. With `revalidate` set, Next emits its
// own ISR cache headers and the CDN answers the refresh without ever waking a
// function.
//
// Freshness is NOT sacrificed: this is a deliberately long window paired with
// an explicit purge — every redirect mutation calls revalidateRedirects()
// (src/lib/revalidate.ts), which invalidates this exact path. Do not replace
// this with a hand-written `Cache-Control` header: a manual s-maxage entry is
// not purgeable by revalidatePath(), so an admin's redirect would sit stale for
// the full window.
export const revalidate = 86400; // 24h ceiling; purged on every redirect change

const getMap = unstable_cache(
  async () => {
    const rows = await db
      .select({ from_path: redirects.fromPath, to_path: redirects.toPath, permanent: redirects.permanent })
      .from(redirects);
    const map: Record<string, { to: string; permanent: boolean }> = {};
    for (const r of rows) map[r.from_path] = { to: r.to_path, permanent: r.permanent };
    return map;
  },
  ["redirect-map"],
  { tags: ["redirects"] }
);

export async function GET() {
  try {
    return NextResponse.json(await getMap());
  } catch {
    return NextResponse.json({});
  }
}
