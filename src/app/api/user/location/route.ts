import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { detectAreaFromHeaders } from "@/lib/geo";
import { getDistrictsForGeo } from "@/lib/data";
import { t, isLocale, type Locale } from "@/lib/i18n";
import type { ClientLocation } from "@/lib/location";

// IP-derived location for <LocationProvider>, used ONLY when the visitor has
// not picked a district themselves (that answer lives in a cookie the client
// can read directly, so the manual path costs no request at all).
//
// This endpoint is intentionally dynamic — it is the one place per visitor
// where reading request headers is correct. It replaces the old arrangement
// where every public PAGE read headers() and therefore could not be cached:
// one small JSON response per visitor per 30 minutes, instead of a full React
// render on every page view.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rawLocale = new URL(request.url).searchParams.get("locale");
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "bn";

  try {
    const h = await headers();
    const geo = await detectAreaFromHeaders(h);

    // detectAreaFromHeaders resolves to a thana; the district name it carries
    // is whatever that thana belongs to. When only coordinates came back we
    // still try to name a district so the prompt can say "আপনি কি খুলনা থেকে
    // দেখছেন?" rather than showing an unnamed guess.
    let districtName = geo.districtName ? t(geo.districtName, locale) : null;
    if (!districtName && geo.districtId) {
      const districts = await getDistrictsForGeo();
      const hit = districts.find((x) => x.id === geo.districtId);
      districtName = hit ? t(hit.name, locale) : null;
    }

    const payload: ClientLocation = {
      districtSlug: geo.districtSlug,
      districtName,
      areaSlug: geo.areaSlug,
      areaName: geo.areaName ? t(geo.areaName, locale) : null,
      lat: geo.lat,
      lng: geo.lng,
      source: geo.districtSlug || geo.areaSlug || geo.lat !== null ? "ip" : "none",
    };

    return NextResponse.json(payload, {
      headers: {
        // Per-visitor by definition — must never land in a shared cache, and
        // Cloudflare must not "Cache Everything" this path. The client parks
        // the answer in localStorage for 30 minutes instead.
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    // Geo is a nice-to-have. A failure here must degrade to "we don't know",
    // never to an error the provider has to handle.
    return NextResponse.json(
      { districtSlug: null, districtName: null, areaSlug: null, areaName: null, lat: null, lng: null, source: "none" } satisfies ClientLocation,
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
