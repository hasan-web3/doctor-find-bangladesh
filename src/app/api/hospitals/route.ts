import { NextResponse } from "next/server";
import { searchHospitals } from "@/lib/data";
import { geoRankingFromParams } from "@/lib/geo-request";
import { isLocale, type Locale } from "@/lib/i18n";

// Paginated hospital list for <HospitalListClient> on /hospitals.
//
// Deliberately does NOT call detectArea(): the visitor's location arrives as
// explicit query params from <LocationProvider>, which already resolved it in
// the browser. That keeps this handler free of cookies()/headers(), lets the
// response be shared in a CDN cache, and — the part that actually mattered —
// means the list is ranked by the same location every other surface uses.

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const locale = sp.get("locale");
  const page = Number(sp.get("page") || "1");
  const perPage = Number(sp.get("perPage") || "12");

  if (!locale || !isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  try {
    const ranking = await geoRankingFromParams(sp, locale as Locale);
    // searchHospitals only reads lat/lng off the geo it is handed, so pass the
    // ranking coordinates through in the shape it expects.
    const results = await searchHospitals({ page, perPage }, locale as Locale, {
      areaId: ranking.preferAreaId,
      areaSlug: null,
      areaName: null,
      districtId: ranking.preferDistrictId,
      districtSlug: null,
      districtName: null,
      lat: ranking.preferLat,
      lng: ranking.preferLng,
      source: "district",
    });
    return NextResponse.json(results, {
      headers: {
        // Same query = same answer for everyone, so the CDN can absorb repeats.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Failed to search hospitals:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
