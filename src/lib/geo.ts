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

// ---------------------------------------------------------------------------
// Resolving a raw IP answer to somewhere we actually serve
// ---------------------------------------------------------------------------
// DISTRICT granularity, always. This used to match against the 600+ thana list,
// where a substring test on the city name ("Dhaka") picked whichever thana
// happened to sort first — "Airport (Dhaka)" / বিমানবন্দর — and then presented
// it as the visitor's town. An IP tells you a city at best; inventing a thana
// from it is false precision, it preselected the wrong chamber filter in the
// hero search, and it is exactly the kind of over-confident answer the district
// prompt exists to replace.

// Fold "Khulna Division", "Dhaka District", "Khulna Sadar" and friends down to
// the bare place name so a provider's phrasing cannot decide whether we match.
const NAME_NOISE = /\b(division|district|city|sadar|metropolitan|upazila|thana|zila|zilla)\b/g;

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(NAME_NOISE, " ")
    .replace(/[^a-z0-9ঀ-৿]+/g, " ")
    .trim();
}

// Whole-name or whole-word equality only. The old test allowed any substring in
// either direction, which is what let a three-letter fragment match a district
// it has nothing to do with.
function namesMatch(candidate: string, city: string): boolean {
  const a = normalizeName(candidate);
  const b = normalizeName(city);
  if (!a || !b) return false;
  if (a === b) return true;
  // "khulna" vs "khulna division" (already stripped) or "greater khulna": accept
  // only when the district name appears as a complete word inside the city
  // string, never as a fragment of a longer word.
  if (a.length < 4) return false;
  return new RegExp(`(^| )${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(b);
}

function matchDistrictByName(districts: GeoDistrict[], city: string): GeoDistrict | null {
  return (
    districts.find((x) => namesMatch(x.name.en || "", city)) ||
    districts.find((x) => namesMatch(x.name.bn || "", city)) ||
    null
  );
}

// Nearest district by great-circle distance. Deliberately NOT "nearest district
// that has doctors": this answers "where is the visitor", and pushing them into
// a district they are not in to find one with stock would mislabel every
// heading. When their own district turns out to be empty, <GeoShell> already
// explains the substitution and the listings already rank around the district
// whose doctors are shown.
const MAX_REASONABLE_KM = 200;

function nearestDistrict(districts: GeoDistrict[], lat: number, lng: number): GeoDistrict | null {
  let best: GeoDistrict | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const x of districts) {
    if (x.lat === null || x.lng === null) continue;
    const dist = haversineKm(lat, lng, x.lat, x.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = x;
    }
  }
  return bestDist <= MAX_REASONABLE_KM ? best : null;
}

export type IpLocation = { city: string | null; country_code: string | null; lat: number | null; lng: number | null };

// Vercel's edge network sets these headers on every request for free (no
// external HTTP call, no key), so they stay the first thing we look at.
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

// ---------------------------------------------------------------------------
// Is this answer actually about the visitor, or just about their country?
// ---------------------------------------------------------------------------
// Vercel's edge geo is MaxMind-backed, and MaxMind has no city record for a lot
// of small South Asian ISPs. It does not leave the fields blank when that
// happens — it answers with the COUNTRY's registered centre and a city name to
// match. For Bangladesh that point is Dhaka (23.7115, 90.4111), so every
// visitor on such an ISP was told "Dhaka" with no way to tell that apart from a
// real Dhaka reading, and the code returned before the admin-configured ip-api
// / ipinfo integration was ever consulted — making it dead code in production.
//
// There is no accuracy header to read, so we compare against the centroids we
// care about. A genuine Dhaka visitor trips this too; that costs one cached
// provider lookup which returns Dhaka anyway, so the check is safe in both
// directions and never makes an answer worse.
const COUNTRY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  BD: { lat: 23.7115, lng: 90.4111 },
};

// Generous enough to absorb the small differences between MaxMind releases,
// tight enough that a real reading inside the capital's suburbs is still its
// own answer once the provider confirms it.
const CENTROID_TOLERANCE_KM = 10;

function isCountryCentroid(loc: IpLocation): boolean {
  const centre = loc.country_code ? COUNTRY_CENTROIDS[loc.country_code.toUpperCase()] : undefined;
  if (!centre || loc.lat === null || loc.lng === null) return false;
  return haversineKm(loc.lat, loc.lng, centre.lat, centre.lng) <= CENTROID_TOLERANCE_KM;
}

/** True when the answer names no place at all, or only names the country. */
function isCoarse(loc: IpLocation | null): boolean {
  if (!loc) return true;
  if (!loc.city && loc.lat === null && loc.lng === null) return true;
  return isCountryCentroid(loc);
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

// Resolve a raw IpLocation to a GeoResult, at district granularity.
//
// The returned lat/lng are the IP's OWN coordinates, not the district centre:
// they are the more precise of the two and every distance ranking downstream
// wants the finer number. `areaId` stays null on purpose — see the block above
// matchDistrictByName.
function resolveLocation(loc: IpLocation, districts: GeoDistrict[]): GeoResult {
  const named = loc.city ? matchDistrictByName(districts, loc.city) : null;
  if (named) {
    return { ...withDistrict(named), lat: loc.lat, lng: loc.lng, source: "ip-name" };
  }
  if (loc.lat !== null && loc.lng !== null) {
    const near = nearestDistrict(districts, loc.lat, loc.lng);
    if (near) {
      return { ...withDistrict(near), lat: loc.lat, lng: loc.lng, source: "ip-nearest" };
    }
  }
  return { ...EMPTY, lat: loc.lat, lng: loc.lng };
}

function clientIpFrom(h: Headers): string {
  return h.get("x-client-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
}

function isUsableIp(ip: string): boolean {
  return Boolean(ip) && ip !== "::1" && !ip.startsWith("127.") && !ip.startsWith("192.168.") && !ip.startsWith("10.");
}

// The network's best guess at where the visitor is, as a raw IpLocation.
//
// Order:
//   1. Vercel edge headers, when they name a real place. Free, no round trip.
//   2. The configured ip-api / ipinfo provider, when tier 1 is missing or only
//      resolved to the country centre (see isCoarse). Cached 30 minutes per IP,
//      so a busy site pays for one lookup per visitor network per half hour.
//   3. Whatever tier 1 gave us, even if coarse — a country-level guess still
//      orders the district picker better than nothing does.
async function lookupNetworkLocation(h: Headers): Promise<IpLocation | null> {
  const vercelLoc = readVercelGeo(h);
  if (vercelLoc && !isCoarse(vercelLoc)) return vercelLoc;

  const ip = clientIpFrom(h);
  if (isUsableIp(ip)) {
    const providerLoc = await lookupIp(ip);
    if (!isCoarse(providerLoc)) return providerLoc;
    // Both are coarse. Prefer the provider only when it named something and
    // Vercel did not, so we never trade a real answer for an empty one.
    if (!vercelLoc && (providerLoc.city || providerLoc.lat !== null)) return providerLoc;
  }

  return vercelLoc;
}

// Header-only detection.
//
// Deliberately reads NO cookies, so it is safe to call from a route handler
// that must not depend on the visitor's stored answer — /api/user/location is
// purely the "where does the network think you are" tier. The manual choice is
// resolved on the client, which already has the cookie and the district list
// and therefore needs no round trip at all.
export async function detectAreaFromHeaders(h: Headers): Promise<GeoResult> {
  const loc = await lookupNetworkLocation(h);
  if (!loc) return EMPTY;
  const districts = (await getDistrictsForGeo()) as GeoDistrict[];
  return resolveLocation(loc, districts);
}

// Non-cached IP lookup helper (kept for callers that only have a raw IP).
export async function detectAreaByIp(ip: string): Promise<GeoResult> {
  if (!isUsableIp(ip)) return EMPTY;
  const loc = await lookupIp(ip);
  const districts = (await getDistrictsForGeo()) as GeoDistrict[];
  return resolveLocation(loc, districts);
}

// Visitor's served area. Preference order:
//   1. `db_area` cookie — the visitor manually picked a thana, most specific
//      answer we can have, so it wins outright.
//   2. `db_district` cookie — the visitor answered the district prompt. Once
//      this exists we stop asking the network where they are entirely: a
//      stated district beats an inferred one even when the IP disagrees,
//      which is exactly the case this tier is here to fix.
//   3. The network's guess, via lookupNetworkLocation() — Vercel edge headers
//      when they name a real place, the configured ip-api / ipinfo provider
//      when they only resolve to the country centre. District granularity
//      only; an IP cannot honestly name a thana.
//
// Tier 3 is only a *hint*: it orders the district prompt and drives the "you
// seem to be browsing from…" strip until the visitor answers.
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
  return detectAreaFromHeaders(h);
});
