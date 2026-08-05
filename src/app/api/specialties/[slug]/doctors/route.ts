import { NextResponse } from "next/server";
import { searchDoctors } from "@/lib/data";
import { geoRankingFromParams } from "@/lib/geo-request";
import { isLocale, type Locale } from "@/lib/i18n";

// Doctors for one specialty, for <SpecialtyDoctorListClient>.
//
// Location arrives as explicit query params from <LocationProvider> rather than
// from detectArea() here — see src/lib/geo-request.ts for why.

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const sp = new URL(req.url).searchParams;
  const locale = sp.get("locale");
  const q = sp.get("q") || undefined;
  const page = Number(sp.get("page") || "1");
  const perPage = Number(sp.get("perPage") || "12");

  if (!locale || !isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  try {
    const ranking = await geoRankingFromParams(sp, locale as Locale);
    const results = await searchDoctors(
      { specialty: slug, q, page, perPage, ...ranking },
      locale as Locale
    );
    return NextResponse.json(results, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Failed to search doctors for specialty:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
