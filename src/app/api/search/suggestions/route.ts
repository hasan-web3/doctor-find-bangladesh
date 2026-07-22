import { NextResponse } from "next/server";
import { searchDoctors, type DoctorSearchParams } from "@/lib/data";
import { detectArea } from "@/lib/geo";
import { isLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

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

  // We still want the suggestions to be location-aware
  const geo = await detectArea();

  const params: DoctorSearchParams = {
    q,
    perPage: 5, // Limit to 5 suggestions
    preferLat: geo.lat,
    preferLng: geo.lng,
    preferAreaId: geo.areaId,
    preferDistrictId: geo.districtId,
  };

  try {
    // searchDoctors is perfect for this, as it's already fuzzy and location-aware.
    const { rows } = await searchDoctors(params, locale);
    
    // We only need a subset of data for the suggestion list.
    const suggestions = rows.map(doc => ({
      name: doc.name,
      slug: doc.slug,
      specialty: doc.specialty,
    }));

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error("Doctor suggestion API error:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
