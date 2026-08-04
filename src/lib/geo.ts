import "server-only";
import { cache } from "react";
import { headers, cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { getAreasForGeo, getDistrictsForGeo } from "./data";
import { getEnabledConfig } from "./integrations";

export type GeoResult = {
  areaId: number | null;
  areaSlug: string | null;
  areaName: { bn?: string; en?: string } | null;
  districtId: number | null;
  districtSlug: string | null;
  districtName: { bn?: string; en?: string } | null;
  lat: number | null;
  lng: number | null;
  // "district" = the visitor answered the district prompt themselves. That
  // answer outranks every inferred signal, because IP geolocation resolves to
  // the ISP's exit node, not the person: a Khulna visitor on a Dhaka-routed
  // provider gets told "Dhaka" and every nearest-first list is wrong for them.
  source: "cookie" | "district" | "ip-name" | "ip-nearest" | "none";
};

// Cookie names/TTLs live in the client-safe module so <LocationProvider> and
// the server actions cannot drift apart on the spelling. Re-exported here so
// existing server-side importers keep working unchanged.
export { DISTRICT_COOKIE, DISTRICT_COOKIE_MAX_AGE, AREA_COOKIE } from "./location";
import { DISTRICT_COOKIE } from "./location";

type GeoArea = {
  id: number;
  slug: string;
  name: { bn?: string; en?: string };
  district_id: number | null;
  district_slug: string | null;
  district_name: { bn?: string; en?: string } | null;
  lat: number | null;
  lng: number | null;
  doctorCount: number;
};

export type GeoDistrict = {
  id: number;
  slug: string;
  name: { bn?: string; en?: string };
  lat: number | null;
  lng: number | null;
  doctorCount: number;
};

// A visitor-chosen district resolves to district-level coordinates and no
// thana. Leaving areaId null is intentional: we know their district, we do NOT
// know their thana, and guessing one would re-introduce the false precision
// this whole flow exists to remove. Every consumer already treats a null
// areaId as "no thana preference" and ranks by districtId + lat/lng instead.
function withDistrict(district: GeoDistrict): GeoResult {
  return {
    areaId: null, areaSlug: null, areaName: null,
    districtId: district.id, districtSlug: district.slug, districtName: district.name,
    lat: district.lat, lng: district.lng, source: "district",
  };
}



const EMPTY: GeoResult = {
  areaId: null, areaSlug: null, areaName: null,
  districtId: null, districtSlug: null, districtName: null,
  lat: null, lng: null, source: "none",
};

// ---------------------------------------------------------------------------
// The canonical, visitor-independent geo used by every ISR page.
// ---------------------------------------------------------------------------
// Public pages must render ONE document that is correct for everybody, or they
// cannot be cached on a shared CDN — the first visitor's district would be
// served to every visitor after them. Passing this into geoSearchPrefs() turns
// off distance ranking and area/district preference, leaving the site's own
// ordering (featured, then verified, then the admin's curated priority list).
//
// resolveDisplayDistrict() still resolves a real district name from it — the
// district of the top-ranked doctor — so headings read naturally ("খুলনার
// ডাক্তারদের তালিকা") rather than going blank, and that name is the same for
// every visitor and for Googlebot.
//
// The visitor's ACTUAL location is applied after hydration by
// <LocationProvider> (src/components/public/location-provider.tsx).
export const STATIC_GEO: GeoResult = EMPTY;

function withArea(area: GeoArea, source: GeoResult["source"], ipLat: number | null, ipLng: number | null): GeoResult {
  return {
    areaId: area.id, areaSlug: area.slug, areaName: area.name,
    districtId: area.district_id, districtSlug: area.district_slug, districtName: area.district_name,
    lat: ipLat, lng: ipLng, source,
  };
}

// Haversine lives in the client-safe module now (the browser does the distance
// ranking). Re-exported so server-side importers of `@/lib/geo` are unchanged.
export { haversineKm } from "./location";
import { haversineKm } from "./location";

function matchByName(areas: GeoArea[], city: string): GeoArea | null {
  const needle = city.toLowerCase();
  return (
    areas.find((a) => {
      const en = (a.name.en || "").toLowerCase();
      const bn = a.name.bn || "";
      return (en && (needle.includes(en) || en.includes(needle))) || (bn && needle.includes(bn));
    }) || null
  );
}

// Nearest area (by great-circle distance) that has at least one active doctor.
// If none has a doctor, falls back to the geographically nearest anyway.
function nearestAreaWithDoctors(
  areas: GeoArea[],
  lat: number,
  lng: number
): GeoArea | null {
  const MAX_REASONABLE_KM = 200;
  const withCoords = areas.filter((a) => a.lat !== null && a.lng !== null);
  if (withCoords.length === 0) return null;
  const ranked = withCoords
    .map((a) => ({ area: a, dist: haversineKm(lat, lng, a.lat!, a.lng!) }))
    .sort((x, y) => x.dist - y.dist);

  if (ranked.length === 0 || ranked[0].dist > MAX_REASONABLE_KM) {
    return null;
  }

  const withDoctor = ranked.find((r) => r.area.doctorCount > 0);
  return (withDoctor ?? ranked[0]).area;
}

export type IpLocation = { city: string | null; country_code: string | null; lat: number | null; lng: number | null };

// Vercel's edge network sets these headers on every request for free (no
// external HTTP call, no key). Prefer them whenever they're present so
// detectArea() never has to reach ip-api / ipinfo on Vercel deployments.
function readVercelGeo(h: Headers): IpLocation | null {
  const city = h.get("x-vercel-ip-city");
  const country = h.get("x-vercel-ip-country");
  const latS = h.get("x-vercel-ip-latitude");
  const lngS = h.get("x-vercel-ip-longitude");
  if (!city && !country && !latS && !lngS) return null;
  const lat = latS ? Number(latS) : NaN;
  const lng = lngS ? Number(lngS) : NaN;
  return {
    city: city ? decodeURIComponent(city) : null,
    country_code: country || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

// How long an external IP-geo answer stays good for. Only the paid/free
// provider path is cached — Vercel's own headers are free to read, so caching
// those would buy nothing and would serve a stale city after the visitor
// switches network, VPN, or town.
const IP_GEO_TTL_SECONDS = 60 * 30;

// The raw provider call. No DB reads and no caching in here so it is safe to
// wrap in unstable_cache (which forbids cookies()/headers() inside).
async function fetchIpLocation(
  ip: string,
  provider: string | null,
  apiKey: string | null,
): Promise<IpLocation> {
  const empty: IpLocation = { city: null, country_code: null, lat: null, lng: null };
  try {
    if (provider === "ipinfo" && apiKey) {
      const res = await fetch(`https://ipinfo.io/${ip}?token=${apiKey}`);
      if (!res.ok) return empty;
      const data = await res.json();
      // ipinfo returns "loc": "22.8098,89.5551".
      const [latS, lngS] = String(data.loc || "").split(",");
      const lat = Number(latS);
      const lng = Number(lngS);
      return {
        city: data.city || data.region || null,
        country_code: data.country || null,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
      };
    }
    // Free default: ip-api.com — no key needed, returns city + coords.
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode,city,regionName,lat,lon`);
    if (!res.ok) return empty;
    const data = await res.json();
    if (data.status !== "success") return empty;
    return {
      city: data.city || data.regionName || null,
      country_code: data.countryCode || null,
      lat: Number.isFinite(data.lat) ? data.lat : null,
      lng: Number.isFinite(data.lon) ? data.lon : null,
    };
  } catch {
    return empty;
  }
}

// 30-minute server-side cache of the external lookup, keyed by IP (+ provider).
// This is what the old `geo-location-cache` cookie used to do, moved server
// side: no Set-Cookie / Cookie bytes on every request, it still works for
// visitors who block cookies, and one lookup is shared by every request from
// the same IP instead of once per browser.
export async function lookupIp(ip: string): Promise<IpLocation> {
  // getEnabledConfig reads the DB, so it must run OUTSIDE unstable_cache.
  const cfg = await getEnabledConfig("ip_geo");
  const provider = cfg?.provider ?? null;
  const apiKey = cfg?.api_key ?? null;

  return unstable_cache(
    () => fetchIpLocation(ip, provider, apiKey),
    ["ip-geo", provider ?? "default", ip],
    { revalidate: IP_GEO_TTL_SECONDS, tags: ["ip-geo"] },
  )();
}

// Resolve a raw IpLocation to a GeoResult against our known areas.
function resolveLocation(loc: IpLocation, areas: GeoArea[]): GeoResult {
  if (loc.city) {
    const named = matchByName(areas, loc.city);
    if (named) return withArea(named, "ip-name", loc.lat, loc.lng);
  }
  if (loc.lat !== null && loc.lng !== null) {
    const near = nearestAreaWithDoctors(areas, loc.lat, loc.lng);
    if (near) return withArea(near, "ip-nearest", loc.lat, loc.lng);
  }
  return { ...EMPTY, lat: loc.lat, lng: loc.lng };
}

// Header-only detection: Vercel edge geo first, external IP-geo as fallback.
//
// Deliberately reads NO cookies, so it is safe to call from a route handler
// that must not depend on the visitor's stored answer — /api/user/location is
// purely the "where does the network think you are" tier. The manual choice is
// resolved on the client, which already has the cookie and the district list
// and therefore needs no round trip at all.
export async function detectAreaFromHeaders(h: Headers): Promise<GeoResult> {
  const areas = (await getAreasForGeo()) as GeoArea[];

  // Fast path — Vercel edge already told us where the visitor is, for free.
  const vercelLoc = readVercelGeo(h);
  if (vercelLoc) {
    const resolved = resolveLocation(vercelLoc, areas);
    if (resolved.areaSlug) return resolved;
    if (vercelLoc.lat !== null || vercelLoc.city) return resolved;
  }

  // Local dev / non-Vercel host — fall back to the paid/free IP-geo provider.
  const ip = h.get("x-client-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  if (ip) return detectAreaByIp(ip);

  return EMPTY;
}

// Non-cached IP lookup helper (kept for callers that only have a raw IP).
export async function detectAreaByIp(ip: string): Promise<GeoResult> {
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.")) {
    return EMPTY;
  }
  const loc = await lookupIp(ip);
  const areas = (await getAreasForGeo()) as GeoArea[];
  return resolveLocation(loc, areas);
}

// Visitor's served area. Preference order:
//   1. `db_area` cookie — the visitor manually picked a thana, most specific
//      answer we can have, so it wins outright.
//   2. `db_district` cookie — the visitor answered the district prompt. Once
//      this exists we stop asking the network where they are entirely: a
//      stated district beats an inferred one even when the IP disagrees,
//      which is exactly the case this tier is here to fix.
//   3. Vercel edge headers (`x-vercel-ip-*`) — free and sub-millisecond, so
//      they are read fresh on every request. Deliberately NOT cached in a
//      cookie: that only bought stale coordinates once the visitor changed
//      network, VPN or city, and cost Cookie/Set-Cookie bytes on every hit.
//   4. External IP-geo provider — only reachable when the Vercel headers are
//      absent (local dev / self-hosted). That call IS cached for 30 minutes
//      per IP inside lookupIp(), since it is the expensive one.
//
// Tiers 3–4 are now only a *hint*: they order the district prompt and drive
// the "you seem to be browsing from…" strip until the visitor answers.
//
// Wrapped in React `cache` so multiple calls inside the same request (e.g.
// generateMetadata + page component) share one result. IP-geo can't run in
// middleware — unstable_cache-backed helpers throw there — so it stays here.
export const detectArea = cache(async (): Promise<GeoResult> => {
  const jar = await cookies();
  const areas = (await getAreasForGeo()) as GeoArea[];

  const chosen = jar.get("db_area")?.value;
  if (chosen) {
    const area = areas.find((a) => a.slug === chosen);
    if (area) return withArea(area, "cookie", area.lat, area.lng);
  }

  const chosenDistrict = jar.get(DISTRICT_COOKIE)?.value;
  if (chosenDistrict) {
    const districts = (await getDistrictsForGeo()) as GeoDistrict[];
    const district = districts.find((x) => x.slug === chosenDistrict);
    // A district with no coordinates still wins — we know the district id,
    // which is enough to filter by; distance ranking simply stays off.
    if (district) return withDistrict(district);
  }

  const h = await headers();

  // Fast path — Vercel edge already told us where the visitor is.
  const vercelLoc = readVercelGeo(h);
  if (vercelLoc) {
    const resolved = resolveLocation(vercelLoc, areas);
    if (resolved.areaSlug) return resolved;
    // If Vercel gave us coords but no area match, we still return what we know
    // — no external fetch will improve it.
    if (vercelLoc.lat !== null || vercelLoc.city) return resolved;
  }

  // Local dev / non-Vercel host — fall back to the paid/free IP-geo provider.
  const ip = h.get("x-client-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  if (ip) {
    const geo = await detectAreaByIp(ip);
    if (geo.areaSlug) return geo;
  }

  return EMPTY;
});
