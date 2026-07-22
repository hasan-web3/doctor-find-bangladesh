import { NextResponse } from "next/server";
import { getHospitalBySlug, searchDoctors } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/i18n";
import { detectArea } from "@/lib/geo";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") as Locale | null;
  const q = searchParams.get("q") || undefined;
  const specialty = searchParams.get("specialty") || undefined;
  const page = Number(searchParams.get("page") || "1");
  const perPage = Number(searchParams.get("perPage") || "12");

  if (!locale || !isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  try {
    const hospital = await getHospitalBySlug(slug, locale);
    if (!hospital) {
      return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
    }
    
    const geo = await detectArea();

    const results = await searchDoctors(
      {
        hospitalId: hospital.id,
        q,
        specialty: specialty ? specialty.split(",") : undefined,
        page,
        perPage,
        preferLat: geo.lat,
        preferLng: geo.lng
      },
      locale
    );
    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to search doctors for hospital:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
