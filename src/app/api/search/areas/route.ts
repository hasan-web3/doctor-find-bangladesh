import { NextResponse } from "next/server";
import { searchAreas, type AreaSearchParams } from "@/lib/data";
import { geoRankingFromParams } from "@/lib/geo-request";
import { isLocale, type Locale } from "@/lib/i18n";

// Thana index for <AreaListClient>.
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

  const params: AreaSearchParams = {
    q: sp.get("q") || undefined,
    page: sp.has("page") ? Number(sp.get("page")) : 1,
    perPage: sp.has("perPage") ? Number(sp.get("perPage")) : 50,
    preferLat: ranking.preferLat,
    preferLng: ranking.preferLng,
    preferAreaId: ranking.preferAreaId,
    preferDistrictId: ranking.preferDistrictId,
  };

  try {
    const { rows, total } = await searchAreas(params, locale as Locale);
    return NextResponse.json(
      { rows, total },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    console.error("Area search API error:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
