import { NextResponse } from "next/server";
import { searchDoctors, getDistrictsForGeo, type DoctorSearchParams } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/i18n";

// Filtered / paginated doctor search for <DoctorListClient> on /doctors.
//
// The page itself is now static ISR and renders only the canonical unfiltered
// first page. Every filter, sort and page change is applied here instead, so
// one cached HTML document serves every visitor and only the *result set*
// travels over the wire.
//
// Deliberately does NOT call detectArea(): the visitor's location arrives as
// explicit query params from <LocationProvider>, which already resolved it in
// the browser. That keeps this handler free of cookies()/headers() and means
// identical queries from different visitors share a CDN cache entry.

function list(v: string | null): string[] | undefined {
  if (!v) return undefined;
  const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const rawLocale = sp.get("locale");
  if (!isLocale(rawLocale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }
  const locale: Locale = rawLocale;

  try {
    // The visitor's district, as resolved client-side. Translated to an id here
    // because searchDoctors ranks by id, and the client only knows the slug.
    //
    // `priorityDistrict` is the separate "this page IS a district" case: a
    // district listing pins its own curated order regardless of where the
    // visitor is. Both slugs resolve from one cached read.
    const preferDistrictSlug = sp.get("preferDistrict");
    const priorityDistrictSlug = sp.get("priorityDistrict");
    let preferDistrictId: number | null = null;
    let pinnedDistrictId: number | null = null;
    if (preferDistrictSlug || priorityDistrictSlug) {
      const districts = await getDistrictsForGeo();
      preferDistrictId = preferDistrictSlug
        ? districts.find((x) => x.slug === preferDistrictSlug)?.id ?? null
        : null;
      pinnedDistrictId = priorityDistrictSlug
        ? districts.find((x) => x.slug === priorityDistrictSlug)?.id ?? null
        : null;
    }

    const lat = sp.get("preferLat");
    const lng = sp.get("preferLng");
    const sort = sp.get("sort") as DoctorSearchParams["sort"] | null;
    const maxFee = sp.get("maxFee");

    const params: DoctorSearchParams = {
      q: sp.get("q") || undefined,
      specialty: list(sp.get("specialty")),
      area: list(sp.get("area")),
      district: list(sp.get("district")),
      hospital: list(sp.get("hospital")),
      gender: sp.get("gender") || undefined,
      maxFee: maxFee ? Number(maxFee) : undefined,
      sort: sort || undefined,
      page: Math.max(1, Number(sp.get("page") || "1")),
      perPage: Math.max(1, Number(sp.get("perPage") || "12")),
      // An explicit area filter or an explicit sort replaces geo ranking —
      // mirrors what the page component used to do server-side.
      preferAreaId: null,
      preferDistrictId: !sp.get("area") && !sort ? preferDistrictId : null,
      preferLat: !sort && lat ? Number(lat) : null,
      preferLng: !sort && lng ? Number(lng) : null,
      // Unconditional: an explicit filter narrows *which* doctors are listed,
      // it does not mean the admin's curated order stops applying.
      priorityDistrictId: pinnedDistrictId ?? preferDistrictId,
    };

    const results = await searchDoctors(params, locale);

    return NextResponse.json(results, {
      headers: {
        // Same query = same answer for everyone, so let the CDN absorb the
        // repeats (filter combinations repeat heavily in practice). Short
        // enough that a newly published doctor shows up quickly.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Doctor search API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
