import { NextResponse } from "next/server";
import { searchDistricts, type DistrictSearchParams } from "@/lib/data";
import { geoRankingFromParams } from "@/lib/geo-request";
import { isLocale, type Locale } from "@/lib/i18n";

// District index for <DistrictListClient>.
//
// Location arrives as explicit query params from <LocationProvider> rather than
// from detectArea() here — see src/lib/geo-request.ts for why.

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;

  const locale = sp.get("locale");
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const ranking = await geoRankingFromParams(sp, locale as Locale);

  const params: DistrictSearchParams = {
    q: sp.get("q") || undefined,
    page: sp.has("page") ? Number(sp.get("page")) : 1,
    perPage: sp.has("perPage") ? Number(sp.get("perPage")) : 24,
    preferLat: ranking.preferLat,
    preferLng: ranking.preferLng,
    preferDistrictId: ranking.preferDistrictId,
  };

  try {
    const { rows, total } = await searchDistricts(params, locale as Locale);
    return NextResponse.json(
      { rows, total },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    console.error("District search API error:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
