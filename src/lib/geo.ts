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

// This call now sits in front of every first-time visitor rather than behind
// Vercel's headers, so a provider having a bad day must not become the site
// having a bad day. Past this budget we give up and fall back to the headers.
const IP_GEO_TIMEOUT_MS = 2500;

// The raw provider call. No DB reads and no caching in here so it is safe to
// wrap in unstable_cache (which forbids cookies()/headers() inside).
//
// Every failure path returns `empty` rather than throwing: the caller reads
// that as "provider unavailable" and uses Vercel's headers instead. A 429 from
// ip-api's free tier is the most likely one in production and is handled by
// exactly the same path.
async function fetchIpLocation(
  ip: string,
  provider: string | null,
  apiKey: string | null,
): Promise<IpLocation> {
  const empty: IpLocation = { city: null, country_code: null, lat: null, lng: null };
  const signal = AbortSignal.timeout(IP_GEO_TIMEOUT_MS);
  try {
    // Encoded even though getClientIp() has already validated the shape: this
    // value comes from a request header and must never be able to shape the URL.
    const safeIp = encodeURIComponent(ip);
    if (provider === "ipinfo" && apiKey) {
      const res = await fetch(`https://ipinfo.io/${safeIp}?token=${encodeURIComponent(apiKey)}`, { signal });
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
    // Free default: ip-api.com — no key needed, returns city + coords. Its free
    // tier is rate limited per calling IP and, on Vercel, that IP is shared, so
    // treat a non-200 as "unavailable" and let the caller fall back.
    const res = await fetch(
      `http://ip-api.com/json/${safeIp}?fields=status,countryCode,city,regionName,lat,lon`,
      { signal }
    );
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

// ---------------------------------------------------------------------------
// Whose IP is this, really?
// ---------------------------------------------------------------------------
// doctorsfindbd.com is served THROUGH CLOUDFLARE, in front of Vercel. That one
// fact broke every layer of this:
//
//   visitor (Khulna) -> Cloudflare PoP -> Vercel -> this function
//
// Vercel's connection comes from Cloudflare, not from the visitor, so
// everything Vercel derives from the socket describes a Cloudflare data centre:
// `x-forwarded-for` and `x-real-ip` are the PoP's address, and the
// `x-vercel-ip-*` geo headers are the PoP's city. Live responses confirm it —
// the `CF-RAY` suffix on this site alternates between `DAC` (Dhaka) and `CGP`
// (Chattogram), which is exactly the pair of wrong answers the site has been
// giving. Reordering the providers did not help because the provider was being
// handed Cloudflare's address and answering about it perfectly correctly.
//
// `cf-connecting-ip` is the only header here that carries the visitor. It is
// set by Cloudflare on every proxied request and cannot be forged through
// Cloudflare (it overwrites whatever the client sent). Someone hitting the
// Vercel origin directly could spoof it, which would give them the wrong
// nearby-doctor ordering and nothing else — no access decision reads this.
const IP_HEADERS = [
  "cf-connecting-ip",  // Cloudflare: the real visitor. Must come first.
  "true-client-ip",    // Cloudflare Enterprise / Akamai equivalent.
  "x-client-ip",       // Our own middleware, forwarded from the above.
  "x-real-ip",         // Generic reverse proxies; on Vercel this is the peer.
  "x-forwarded-for",   // Last resort: a comma-separated chain, client first.
] as const;

// "[2001:db8::1]:443" / "1.2.3.4:5678" / "::ffff:1.2.3.4" all have to come out
// as a bare address, or the provider URL is malformed and the lookup fails —
// which used to look identical to "provider is down" and fell back to Vercel's
// (wrong) headers.
function sanitizeIp(raw: string): string {
  let ip = raw.trim();
  if (!ip) return "";

  // Bracketed IPv6, with or without a port.
  if (ip.startsWith("[")) {
    const close = ip.indexOf("]");
    ip = close === -1 ? ip.slice(1) : ip.slice(1, close);
  }

  // IPv4 with a port. A single colon plus dots can only be host:port; a bare
  // IPv6 address always has two or more colons.
  if (ip.includes(".") && (ip.match(/:/g) || []).length === 1) {
    ip = ip.split(":")[0];
  }

  // IPv4-mapped IPv6, which ip-api and ipinfo both reject.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) ip = mapped[1];

  return ip.trim();
}

function isValidIp(ip: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    return ip.split(".").every((octet) => Number(octet) <= 255);
  }
  // Loose IPv6 check — enough to keep junk out of an outbound URL.
  return ip.includes(":") && /^[0-9a-f:]+$/i.test(ip);
}

/** The visitor's own address, or "" when we only have infrastructure. */
function getClientIp(h: Headers): string {
  for (const name of IP_HEADERS) {
    const raw = h.get(name);
    if (!raw) continue;
    // Only x-forwarded-for is a list, but splitting is harmless on the others
    // and guards against a proxy that decides to chain one of them too.
    const candidate = sanitizeIp(raw.split(",")[0] ?? "");
    if (candidate && isValidIp(candidate)) return candidate;
  }
  return "";
}

// Addresses no geo provider can say anything useful about. Rejecting them here
// keeps a pointless outbound call (and a cached empty answer) from happening.
function isUsableIp(ip: string): boolean {
  if (!ip || !isValidIp(ip)) return false;
  if (ip === "::1" || ip === "::") return false;
  if (/^127\./.test(ip)) return false;              // loopback
  if (/^10\./.test(ip)) return false;               // private
  if (/^192\.168\./.test(ip)) return false;         // private
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false; // private
  if (/^169\.254\./.test(ip)) return false;         // link-local
  if (/^(fc|fd)/i.test(ip)) return false;           // IPv6 unique-local
  if (/^fe80:/i.test(ip)) return false;             // IPv6 link-local
  return true;
}

/**
 * True when this request reached us through Cloudflare.
 *
 * When it did, Vercel's `x-vercel-ip-*` headers describe the Cloudflare PoP
 * rather than the visitor, so they are not a usable backup — they are the
 * source of the wrong answer, not a fallback from it.
 */
function isProxiedByCloudflare(h: Headers): boolean {
  return Boolean(h.get("cf-connecting-ip") || h.get("cf-ray"));
}

// Cloudflare's own visitor geo, when the zone has the "Add visitor location
// headers" managed transform switched on (Cloudflare dashboard → Rules →
// Settings). Unlike Vercel's headers on this deployment, these are derived from
// the VISITOR's address, not from the PoP that happened to take the connection,
// so they are a real backup rather than a source of wrong answers.
//
// Off by default, so this simply returns null until it is enabled — worth
// turning on, because it makes the free path correct again and takes load off
// the rate-limited ip-api tier.
function readCloudflareGeo(h: Headers): IpLocation | null {
  const city = h.get("cf-ipcity");
  const country = h.get("cf-ipcountry");
  const latS = h.get("cf-iplatitude");
  const lngS = h.get("cf-iplongitude");
  if (!city && !latS && !lngS) return null;
  const lat = latS ? Number(latS) : NaN;
  const lng = lngS ? Number(lngS) : NaN;
  return {
    city: city || null,
    country_code: country && country !== "XX" ? country : null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

/**
 * What the request actually told us about the visitor, for `?debug=1` on
 * /api/user/location.
 *
 * This exists because the failure it diagnoses is invisible from the outside:
 * a wrong city here looks exactly like a wrong city from a bad provider, and
 * the only way to tell them apart is to see WHICH header the address came from
 * and whether Cloudflare is in the path. Working that out by redeploying
 * guesses cost most of a day.
 *
 * Returns the visitor their own address and the names of the headers present —
 * nothing they could not read from their own connection.
 */
export function describeGeoHeaders(h: Headers): Record<string, unknown> {
  return {
    resolvedClientIp: getClientIp(h) || null,
    behindCloudflare: isProxiedByCloudflare(h),
    cfRay: h.get("cf-ray"),
    headers: Object.fromEntries(
      [...IP_HEADERS, "x-vercel-ip-city", "x-vercel-ip-country", "cf-ipcity", "cf-ipcountry"].map(
        (name) => [name, h.get(name)]
      )
    ),
    // Which header set is eligible as the backup tier. See
    // lookupNetworkLocation() for why Vercel's are excluded behind Cloudflare.
    backupTier: isProxiedByCloudflare(h)
      ? (readCloudflareGeo(h) ? "cloudflare-visitor-geo" : "none (enable Cloudflare visitor location headers)")
      : "vercel-edge-geo",
  };
}

/** Did this answer name a place at all, coarse or not? */
function namesAPlace(loc: IpLocation | null): boolean {
  return Boolean(loc && (loc.city || (loc.lat !== null && loc.lng !== null)));
}

// The network's best guess at where the visitor is, as a raw IpLocation.
//
// ---------------------------------------------------------------------------
// Why the configured provider goes FIRST
// ---------------------------------------------------------------------------
// Vercel's edge geo is read for free from request headers, so it looked like
// the obvious fast path, and it was tried first with a fall-through for
// "obviously useless" answers (country centroid, or no place at all).
//
// That fall-through does not fire often enough to matter. Vercel is
// MaxMind-backed, and for an ISP MaxMind cannot place, it does not answer with
// the centroid every time — it answers with a plausible-looking city-level
// reading in the country's largest city. From Khulna, live on Vercel, that is a
// confident "Dhaka" at ordinary Dhaka coordinates, indistinguishable from a
// real Dhaka visitor. No heuristic reading a single answer can catch that, so
// the provider was still never consulted and the admin's ip_geo integration
// stayed effectively dead in production.
//
// The configured provider is the one that is actually right here: both ip-api
// and ipinfo place this network in Khulna. So it leads, and Vercel becomes the
// backup for the cases the provider cannot serve.
//
// Behind Cloudflare there is no usable backup at all: the Vercel headers then
// describe the Cloudflare PoP, so falling back to them means answering "Dhaka"
// or "Chattogram" depending on which data centre took the connection. Better
// to admit we do not know and let the visitor tell us.
//
// Cost of leading with it is bounded by two caches that were already in place:
//   • the browser parks the answer in localStorage for 30 minutes, so a visitor
//     hits /api/user/location at most twice an hour, not once per page;
//   • lookupIp() wraps the call in unstable_cache keyed by IP, so ALL visitors
//     behind one IP share a single provider request per 30 minutes.
// A visitor who has chosen a district never reaches this code at all.
//
// Order:
//   1. The configured ip-api / ipinfo provider.
//   2. Vercel edge headers, when the provider is unavailable (not configured,
//      rate-limited, timed out, or a private/local IP) or when the provider
//      only resolved to the country centre and Vercel did better.
async function lookupNetworkLocation(h: Headers): Promise<IpLocation | null> {
  // The backup tier. Behind Cloudflare, Vercel's headers describe the proxy, so
  // Cloudflare's own visitor geo takes their place — when it is enabled. When
  // it is not, there is no backup and we would rather say "unknown" than name
  // the data centre's city.
  const vercelLoc = isProxiedByCloudflare(h) ? readCloudflareGeo(h) : readVercelGeo(h);
  const ip = getClientIp(h);

  if (isUsableIp(ip)) {
    const providerLoc = await lookupIp(ip);
    // A real place from the provider wins outright.
    if (!isCoarse(providerLoc)) return providerLoc;
    // Provider could only manage the country centre. If Vercel did better,
    // take it — that is the one case where the header is the sharper answer.
    if (!isCoarse(vercelLoc)) return vercelLoc;
    // Both vague: still prefer the provider if it named anything.
    if (namesAPlace(providerLoc)) return providerLoc;
  }

  // No usable client IP (local dev, private network), or the provider gave us
  // nothing. A failed provider call is cached as empty for the same 30 minutes,
  // which doubles as a circuit breaker: a rate-limited or down provider is not
  // re-hammered once per visitor, we simply run on Vercel's headers until the
  // window rolls over.
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
//   3. The network's guess, via lookupNetworkLocation() — the configured
//      ip-api / ipinfo provider first, Vercel's edge headers as the backup.
//      District granularity only; an IP cannot honestly name a thana.
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
