import { NextResponse } from "next/server";
import { getNearbyAreas, getDistrictsForGeo } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/i18n";

// The thanas of one district, doctors-first then nearest — the same ranking
// getNearbyAreas gives the server-rendered homepage.
//
// Exists so the homepage's "আপনার এলাকার কাছের ডাক্তার খুঁজুন" chips can follow
// the visitor's district. The page itself is static ISR and names the canonical
// district, so without this the chips stayed on whichever district the
// top-ranked doctor happened to be in.
//
// Deliberately free of cookies()/headers(): the district arrives in the path,
// so identical requests from different visitors share one CDN entry.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const rawLocale = new URL(req.url).searchParams.get("locale");
  if (!isLocale(rawLocale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }
  const locale: Locale = rawLocale;

  try {
    const districts = await getDistrictsForGeo();
    const district = districts.find((x) => x.slug === slug);
    if (!district) return NextResponse.json({ rows: [] });

    // No coordinates passed: getNearbyAreas then ranks by doctor count and the
    // curated sort, which is what we want for a district-wide chip row.
    const rows = await getNearbyAreas(locale, district.id, null, null);
    return NextResponse.json(
      { rows },
      {
        headers: {
          // Thana lists change only when an admin edits areas or doctors, and
          // both purge via revalidation. A short shared TTL absorbs the repeats.
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("District areas API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
