import { NextResponse } from "next/server";
import { searchDistricts, type DistrictSearchParams, resolveDisplayDistrict } from "@/lib/data";
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

  // Same-basis ranking for page 2+ as the server-rendered first page.
  const geo = await detectArea();
  // Rank by the district the site actually NAMES for this visitor, so a
  // client refetch cannot reorder the list around their empty district.
  const display = await resolveDisplayDistrict(geo, locale as Locale);

  const params: DistrictSearchParams = {
    q: searchParams.get("q") || undefined,
    page: searchParams.has("page") ? Number(searchParams.get("page")) : 1,
    perPage: searchParams.has("perPage") ? Number(searchParams.get("perPage")) : 24,
    preferLat: searchParams.has("lat") ? Number(searchParams.get("lat")) : geo.lat,
    preferLng: searchParams.has("lng") ? Number(searchParams.get("lng")) : geo.lng,
    preferDistrictId: display?.id ?? geo.districtId,
  };

  try {
    const { rows, total } = await searchDistricts(params, locale as Locale);
    return NextResponse.json({ rows, total });
  } catch (error) {
    console.error("District search API error:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
