import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { db, redirects } from "@/db";

// Redirect map for the middleware's stale-while-revalidate cache.
// Tag-cached (revalidated on every redirect mutation), so this endpoint is a
// cheap in-memory hit after the first call — never a live DB query per request.
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
