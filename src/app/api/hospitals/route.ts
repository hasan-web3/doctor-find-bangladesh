import { NextResponse } from "next/server";
import { searchHospitals } from "@/lib/data";
import { detectArea } from "@/lib/geo";
import { isLocale, type Locale } from "@/lib/i18n";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale");
  const page = Number(searchParams.get("page") || "1");
  const perPage = Number(searchParams.get("perPage") || "12");

  if (!locale || !isLocale(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  try {
    // Geo detection for ordering by distance
    const geo = await detectArea();
    const results = await searchHospitals({ page, perPage }, locale as Locale, geo);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to search hospitals:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
