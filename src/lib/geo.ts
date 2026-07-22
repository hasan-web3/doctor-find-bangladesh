import "server-only";
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

export async function lookupIp(ip: string): Promise<IpLocation> {
  const empty: IpLocation = { city: null, country_code: null, lat: null, lng: null };
  const cfg = await getEnabledConfig("ip_geo");
  try {
    if (cfg?.provider === "ipinfo" && cfg.api_key) {
      const res = await fetch(`https://ipinfo.io/${ip}?token=${cfg.api_key}`);
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

// Non-cached IP lookup helper used by the middleware.
export async function detectAreaByIp(ip: string): Promise<GeoResult> {
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.")) {
    return EMPTY;
  }

  const loc = await lookupIp(ip);
  const areas = (await getAreasForGeo()) as GeoArea[];

  // Prefer exact-name match — visitor is inside a known area.
  if (loc.city) {
    const named = matchByName(areas, loc.city);
    if (named) return withArea(named, "ip-name", loc.lat, loc.lng);
  }

  // Fallback: nearest area with active doctors (Bagerhat → Khulna, not Dhaka).
  if (loc.lat !== null && loc.lng !== null) {
    const near = nearestAreaWithDoctors(areas, loc.lat, loc.lng);
    if (near) return withArea(near, "ip-nearest", loc.lat, loc.lng);
  }

  return { ...EMPTY, lat: loc.lat, lng: loc.lng };
}

// Visitor's served area: explicit cookie choice wins, then a fast geo-cache
// cookie set by a prior request, and finally IP-based lookup (done here rather
// than in middleware because unstable_cache-backed helpers are illegal there).
export async function detectArea(): Promise<GeoResult> {
  const jar = await cookies();
  const areas = (await getAreasForGeo()) as GeoArea[];

  // 1. Explicit cookie choice wins (user manually picked an area).
  const chosen = jar.get("db_area")?.value;
  if (chosen) {
    const area = areas.find((a) => a.slug === chosen);
    if (area) return withArea(area, "cookie", area.lat, area.lng);
  }

  // 2. Fast path: cached IP result from a previous visit.
  const cached = jar.get("geo-location-cache")?.value;
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed?.areaSlug) {
        const area = areas.find((a) => a.slug === parsed.areaSlug);
        if (area) return withArea(area, "cookie", parsed.lat ?? null, parsed.lng ?? null);
      }
    } catch { /* ignore */ }
  }

  // 3. IP-based lookup using the client IP forwarded by middleware.
  const h = await headers();
  const ip = h.get("x-client-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  if (ip) {
    const geo = await detectAreaByIp(ip);
    if (geo.areaSlug) return geo;
  }

  return EMPTY;
}
