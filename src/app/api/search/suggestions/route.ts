import { NextResponse } from "next/server";
import { searchDoctors, getDistrictsForGeo, type DoctorSearchParams } from "@/lib/data";
import { isLocale } from "@/lib/i18n";

// Provides a lightweight, location-aware list of doctors for search suggestions.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const q = searchParams.get("q");
  const locale = searchParams.get("locale");

  if (!q) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  // Location-aware, but WITHOUT detectArea(). That call read cookies + headers
  // and could reach an external IP-geo provider — on every keystroke past the
  // 2-character threshold, for five autocomplete rows. The client already knows
  // the visitor's district (LocationProvider resolved it once) and passes it as
  // a plain query param, so this handler stays free of request state.
  const preferDistrictSlug = searchParams.get("preferDistrict");
  let preferDistrictId: number | null = null;
  if (preferDistrictSlug) {
    const districts = await getDistrictsForGeo();
    preferDistrictId = districts.find((x) => x.slug === preferDistrictSlug)?.id ?? null;
  }

  const params: DoctorSearchParams = {
    q,
    perPage: 5, // Limit to 5 suggestions
    preferDistrictId,
    priorityDistrictId: preferDistrictId,
  };

  try {
    // searchDoctors is perfect for this, as it's already fuzzy and location-aware.
    const { rows } = await searchDoctors(params, locale);
    
    // We only need a subset of data for the suggestion list.
    const suggestions = rows.map(doc => ({
      name: doc.name,
      slug: doc.slug,
      specialty: doc.specialty,
      photo_url: doc.photo_url ?? null,
    }));

    return NextResponse.json(suggestions, {
      headers: {
        // Autocomplete prefixes repeat enormously across visitors ("ডা", "dr",
        // "car"...), and this handler no longer varies by cookie, so the CDN
        // can absorb the repeats instead of the origin re-running the trigram
        // search for each one.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Doctor suggestion API error:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
