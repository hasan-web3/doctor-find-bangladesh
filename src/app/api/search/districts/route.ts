import { NextResponse } from "next/server";
import { searchDistricts, type DistrictSearchParams } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Extract and validate locale
  const locale = searchParams.get("locale");
  if (!isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  // Build search parameters from URL
  const params: DistrictSearchParams = {
    q: searchParams.get("q") || undefined,
    page: searchParams.has("page") ? Number(searchParams.get("page")) : 1,
    perPage: searchParams.has("perPage") ? Number(searchParams.get("perPage")) : 24,
    preferLat: searchParams.has("lat") ? Number(searchParams.get("lat")) : null,
    preferLng: searchParams.has("lng") ? Number(searchParams.get("lng")) : null,
  };

  try {
    const { rows, total } = await searchDistricts(params, locale as Locale);
    return NextResponse.json({ rows, total });
  } catch (error) {
    console.error("District search API error:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
