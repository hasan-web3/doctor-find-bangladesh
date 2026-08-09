import { NextResponse } from "next/server";
import { getDistrictHubLinks, getDistrictsForGeo } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/i18n";

// The internal-link clouds for ONE district: its thanas, its specialties and
// its hospitals, each with a doctor count.
//
// Why this endpoint exists
// ------------------------
// Every public listing is static ISR, so the HTML in the CDN names ONE
// canonical district for all visitors and for Googlebot. That is deliberate and
// must not change: it is what keeps these routes out of per-request rendering.
//
// But the SEO link blocks under the listing are only useful to a reader when
// they describe the district whose doctors are actually on screen, and that
// district is resolved in the browser (IP, or the visitor's own answer, or the
// nearest district when theirs has none). So the server ships the canonical set
// inside the cached HTML — crawlers index that, and it is what first paint
// shows — and <GeoLinkClouds> swaps in the visitor's district from here.
//
// Deliberately free of cookies() and headers(): the district arrives in the
// path, so every visitor asking about the same district shares one CDN entry
// and this rarely reaches a function at all. Same contract as the sibling
// /api/districts/[slug]/areas route.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = new URL(req.url);
  const rawLocale = url.searchParams.get("locale");
  if (!isLocale(rawLocale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }
  const locale: Locale = rawLocale;

  try {
    // Validate against the districts we actually serve before touching the hub
    // query, so an arbitrary slug cannot make us run three aggregations.
    const districts = await getDistrictsForGeo();
    const district = districts.find((x) => x.slug === slug);
    if (!district) {
      return NextResponse.json({ thanas: [], specialties: [], hospitals: [] });
    }

    const hub = await getDistrictHubLinks(slug, locale);

    // Trimmed before it leaves the server. The blocks render at most this many
    // chips anyway, and a district with 80 thanas would otherwise ship a
    // payload the page never uses.
    return NextResponse.json(
      {
        thanas: hub.thanas.slice(0, 30),
        specialties: hub.specialties.slice(0, 30),
        hospitals: hub.hospitals.slice(0, 20),
      },
      {
        headers: {
          // These lists change only when an admin edits a doctor, area,
          // specialty or hospital, and every one of those purges through
          // revalidation. A shared TTL absorbs the repeat traffic.
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("District hub API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
