import { NextResponse } from "next/server";
import { searchDoctors, getDistrictsForGeo } from "@/lib/data";
import { geoRankingFromParams } from "@/lib/geo-request";
import { isLocale, type Locale } from "@/lib/i18n";

// Doctors in one thana, for <AreaDoctorListClient>.
//
// The URL pins WHICH doctors are listed; the visitor's location only decides
// the order within that thana. So the page's own district supplies both the
// preference and the curated order — someone on /area/doctors/khulna/boyra is
// asking about Boyra, whatever their cookie says — while their coordinates
// still rank the results nearest-first inside it.

export async function GET(
  req: Request,
  { params }: { params: Promise<{ district: string; area: string }> }
) {
  const { district, area } = await params;
  const sp = new URL(req.url).searchParams;
  const locale = sp.get("locale");
  const q = sp.get("q") || undefined;
  const specialty = sp.get("specialty") || undefined;
  const page = Number(sp.get("page") || "1");
  const perPage = Number(sp.get("perPage") || "12");

  if (!locale || !isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  try {
    const districts = await getDistrictsForGeo();
    const ownDistrictId = districts.find((x) => x.slug === district)?.id ?? null;
    const ranking = await geoRankingFromParams(sp, locale as Locale, ownDistrictId);

    const results = await searchDoctors(
      {
        district,
        area,
        q,
        specialty: specialty ? specialty.split(",") : undefined,
        page,
        perPage,
        ...ranking,
        preferDistrictId: ownDistrictId ?? ranking.preferDistrictId,
      },
      locale as Locale
    );
    return NextResponse.json(results, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Failed to search doctors for area:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
