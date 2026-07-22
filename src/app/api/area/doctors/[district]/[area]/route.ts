import { NextResponse } from "next/server";
import { searchDoctors } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/i18n";
import { detectArea } from "@/lib/geo";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ district: string, area: string }> }
) {
  const { district, area } = await params;
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale");
  const q = searchParams.get("q") || undefined;
  const specialty = searchParams.get("specialty") || undefined;
  const page = Number(searchParams.get("page") || "1");
  const perPage = Number(searchParams.get("perPage") || "12");

  if (!locale || !isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  try {
    const geo = await detectArea();
    const results = await searchDoctors(
      {
        district: district,
        area: area,
        q,
        specialty: specialty ? specialty.split(",") : undefined,
        page,
        perPage,
        preferAreaId: geo.areaId,
        preferDistrictId: geo.districtId,
        preferLat: geo.lat,
        preferLng: geo.lng,
      },
      locale as Locale
    );
    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to search doctors for area:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
