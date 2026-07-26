import "server-only";
import { cache } from "react";
import { headers, cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { getAreasForGeo } from "./data";
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
  source: "cookie" | "ip-name" | "ip-nearest" | "none";
};

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



const EMPTY: GeoResult = {
  areaId: null, areaSlug: null, areaName: null,
  districtId: null, districtSlug: null, districtName: null,
  lat: null, lng: null, source: "none",
};

function withArea(area: GeoArea, source: GeoResult["source"], ipLat: number | null, ipLng: number | null): GeoResult {
  return {
    areaId: area.id, areaSlug: area.slug, areaName: area.name,
    districtId: area.district_id, districtSlug: area.district_slug, districtName: area.district_name,
    lat: ipLat, lng: ipLng, source,
  };
}

// Haversine distance in km — good enough for "which area is closest".
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

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
//   1. `db_area` cookie — the visitor manually picked an area, always wins
//   2. Vercel edge headers (`x-vercel-ip-*`) — free and sub-millisecond, so
//      they are read fresh on every request. Deliberately NOT cached in a
//      cookie: that only bought stale coordinates once the visitor changed
//      network, VPN or city, and cost Cookie/Set-Cookie bytes on every hit.
//   3. External IP-geo provider — only reachable when the Vercel headers are
//      absent (local dev / self-hosted). That call IS cached for 30 minutes
//      per IP inside lookupIp(), since it is the expensive one.
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
