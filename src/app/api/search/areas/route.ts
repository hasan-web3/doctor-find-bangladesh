import { NextResponse } from "next/server";
import { searchAreas, type AreaSearchParams, resolveDisplayDistrict } from "@/lib/data";
import { detectArea } from "@/lib/geo";
import { isLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Extract and validate locale
  const locale = searchParams.get("locale");
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  // Resolve the visitor's geo server-side (geo cookie / Vercel edge headers)
  // so page 2+ is ranked on exactly the same basis as the server-rendered
  // page 1. Explicit lat/lng in the query still wins if the client sent them.
  const geo = await detectArea();
  // Rank by the district the site actually NAMES for this visitor, so a
  // client refetch cannot reorder the list around their empty district.
  const display = await resolveDisplayDistrict(geo, locale as Locale);

  const params: AreaSearchParams = {
    q: searchParams.get("q") || undefined,
    page: searchParams.has("page") ? Number(searchParams.get("page")) : 1,
    perPage: searchParams.has("perPage") ? Number(searchParams.get("perPage")) : 50,
    preferLat: searchParams.has("lat") ? Number(searchParams.get("lat")) : geo.lat,
    preferLng: searchParams.has("lng") ? Number(searchParams.get("lng")) : geo.lng,
    preferAreaId: geo.areaId,
    preferDistrictId: display?.id ?? geo.districtId,
  };

  try {
    const { rows, total } = await searchAreas(params, locale as Locale);
    return NextResponse.json({ rows, total });
  } catch (error) {
    console.error("Area search API error:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
