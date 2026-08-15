import { NextResponse } from "next/server";
import { getBlogPosts } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/i18n";

// Feed reader for <BlogListClient>.
//
// /blog is a static ISR page, so it cannot read ?category= or ?page= without
// turning into a per-request render (see the note at the top of
// src/app/[locale]/(public)/blog/page.tsx). The page ships the canonical
// unfiltered first page in its HTML, and the client fetches this route when the
// URL asks for anything else.
//
// Cached at the edge like /api/search/areas: the feed is the same for everyone,
// so a category page is served without touching the database after the first
// hit. Publishing purges the "blog" tag, which is what getBlogPosts reads.
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;

  const locale = sp.get("locale");
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  // Clamped, not trusted: these land in LIMIT/OFFSET. perPage mirrors the
  // options the pager offers (12/24/48/96) so a hand-typed ?perPage=100000
  // cannot ask Postgres for the whole table.
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const perPage = Math.min(96, Math.max(1, Number(sp.get("perPage")) || 12));
  const category = sp.get("category")?.trim() || undefined;

  try {
    const { rows, total } = await getBlogPosts(locale as Locale, { page, perPage, category });
    return NextResponse.json(
      { rows, total },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    console.error("Blog list API error:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
