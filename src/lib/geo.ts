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

// A country-centroid heuristic used to live here, to spot Vercel answering with
// the country's registered centre instead of a real city. It is gone on
// purpose: it was an attempt to judge a single answer's quality from its
// contents, and that cannot work — the wrong answers arrived as ordinary,
// precise-looking city readings. The fix was to stop asking the party that
// cannot see the visitor (see lookupNetworkLocation), not to grade its replies.

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
    // Cloudflare's transform can be configured to send the city without the
    // coordinate pair. Falling back to the matched district's own centre keeps
    // nearest-first ranking working instead of silently switching it off.
    const lat = loc.lat ?? named.lat;
    const lng = loc.lng ?? named.lng;
    return { ...withDistrict(named), lat, lng, source: "ip-name" };
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
// `cf-connecting-ip` would carry the visitor — but on THIS deployment it does
// not survive to the function: a live `?debug=1` shows it null while
// `x-forwarded-for` and `x-real-ip` both hold `172.68.231.150`, a Cloudflare
// address. So there is no visitor IP available here at all, and the ONLY
// trustworthy signal is what Cloudflare tells us directly (see
// readCloudflareGeo). The list below still leads with the proxy-set headers for
// deployments where they do arrive.
//
// Header names are matched case-insensitively by the Headers API, so
// `CF-Connecting-IP` and `cf-connecting-ip` are the same lookup — no casing
// variants are needed.
const IP_HEADERS = [
  "cf-connecting-ip",  // Cloudflare: the real visitor, when it reaches us.
  "true-client-ip",    // Cloudflare Enterprise / Akamai equivalent.
  "x-client-ip",       // Our own middleware, forwarded from the above.
  "x-real-ip",         // Generic reverse proxies; on Vercel this is the peer.
  "x-forwarded-for",   // Last resort: a comma-separated chain, client first.
] as const;

// Cloudflare's published IPv4 ranges. An address in here is a CDN edge, never a
// visitor, and geolocating it is what produced "Dhaka" and "Chattogram".
//
// This is a belt-and-braces guard on top of the cf-ray check: it catches the
// case where the Cloudflare marker headers are missing but the connection still
// came through the CDN, which is exactly how this bug hid for so long.
const CLOUDFLARE_V4_RANGES: ReadonlyArray<readonly [string, number]> = [
  ["173.245.48.0", 20], ["103.21.244.0", 22], ["103.22.200.0", 22],
  ["103.31.4.0", 22], ["141.101.64.0", 18], ["108.162.192.0", 18],
  ["190.93.240.0", 20], ["188.114.96.0", 20], ["197.234.240.0", 22],
  ["198.41.128.0", 17], ["162.158.0.0", 15], ["104.16.0.0", 13],
  ["104.24.0.0", 14], ["172.64.0.0", 13], ["131.0.72.0", 22],
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out = (out << 8) | n;
  }
  return out >>> 0;
}

function isCloudflareIp(ip: string): boolean {
  const addr = ipv4ToInt(ip);
  if (addr === null) return false;
  return CLOUDFLARE_V4_RANGES.some(([base, bits]) => {
    const baseInt = ipv4ToInt(base);
    if (baseInt === null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (addr & mask) === (baseInt & mask);
  });
}

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
  // A CDN edge is infrastructure, not a person. Asking a geo provider about it
  // returns a confident, precise, completely wrong city.
  if (isCloudflareIp(ip)) return false;
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
  if (h.get("cf-connecting-ip") || h.get("cf-ray")) return true;
  // No marker headers, but the address we would otherwise geolocate belongs to
  // Cloudflare — so the connection came through the CDN and Vercel's geo
  // headers describe the PoP just the same. Without this, a stripped cf-ray
  // would quietly put us back on the wrong city.
  return isCloudflareIp(getClientIp(h));
}

// Cloudflare's own visitor geo, from the "Add visitor location headers" managed
// transform (Cloudflare dashboard → Rules → Settings).
//
// This is the BEST source available on this deployment, not a fallback:
//
//   • Cloudflare computes it from the visitor's real address, which it has and
//     we do not — `cf-connecting-ip` never reaches the function here.
//   • It is already in the request. No outbound call, no round trip, no
//     timeout, no rate limit. Reading it costs microseconds.
//   • It is verifiably right for this network: the live debug output shows
//     `cf-ipcity: "Khulna"` in the same request where `x-vercel-ip-city` said
//     "Dhaka" and ip-api (handed Cloudflare's own 172.68.231.150) said "Dhaka".
//
// Returns null when the transform is off, which is why the provider tiers below
// still exist.
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
      [
        ...IP_HEADERS,
        "cf-ipcity", "cf-ipcountry", "cf-iplatitude", "cf-iplongitude", "cf-region",
        "x-vercel-ip-city", "x-vercel-ip-country",
      ].map((name) => [name, h.get(name)])
    ),
    // Which tier actually answered — the one thing that was impossible to see
    // from the outside while this was broken.
    tierUsed: namesAPlace(readCloudflareGeo(h))
      ? "1: cloudflare-visitor-geo (no outbound call)"
      : isUsableIp(getClientIp(h))
        ? "2: ip-geo provider"
        : isProxiedByCloudflare(h)
          ? "none — behind Cloudflare with no visitor geo and no client IP; enable the 'Add visitor location headers' managed transform"
          : "3: vercel-edge-geo",
    clientIpLooksLikeCloudflare: isCloudflareIp(getClientIp(h)),
  };
}

/** Did this answer name a place at all, coarse or not? */
function namesAPlace(loc: IpLocation | null): boolean {
  return Boolean(loc && (loc.city || (loc.lat !== null && loc.lng !== null)));
}

// The network's best guess at where the visitor is, as a raw IpLocation.
//
// ---------------------------------------------------------------------------
// Whoever already knows the answer goes first
// ---------------------------------------------------------------------------
// The rule this settled on: prefer the party that can see the visitor's real
// address. Behind a CDN that is the CDN itself, not us and not an IP-geo API we
// can only feed the CDN's own address to.
//
// Tiers, in order:
//
//   1. Cloudflare visitor geo headers (`cf-ipcity` / `cf-iplatitude` /
//      `cf-iplongitude`). Present on every request once the managed transform
//      is on, computed by Cloudflare from the visitor's true address, and
//      already verified correct for this network ("Khulna") in the same request
//      where every other signal said "Dhaka". Costs a header read: no outbound
//      call, no round trip, no timeout, no rate limit.
//
//   2. The configured ip-api / ipinfo provider — but ONLY with a real visitor
//      address. `isUsableIp` now rejects Cloudflare's own ranges, so this tier
//      simply does not run behind a CDN that hides the client. Feeding it the
//      proxy address is what produced "Dhaka" and "Chattogram"; a wrong answer
//      is worse than no answer, because it silently overrides a right one.
//
//   3. Vercel edge geo headers — only when NOT behind Cloudflare. On this
//      deployment they describe whichever PoP took the connection (`CF-RAY`
//      alternates DAC/CGP, which is exactly the pair of wrong cities), so they
//      are excluded rather than used as a fallback.
//
// Nothing else is left, and returning "unknown" is the honest outcome: the
// district prompt then asks, and a stated district beats every inferred one.
//
// Performance: tier 1 is pure header parsing, so the common path makes no
// network call at all. On top of that, the browser parks the result in
// localStorage for 30 minutes and a visitor who has chosen a district never
// reaches this code.
async function lookupNetworkLocation(h: Headers): Promise<IpLocation | null> {
  const behindCloudflare = isProxiedByCloudflare(h);

  // --- tier 1: Cloudflare already worked it out, from the real client -------
  const cloudflareLoc = readCloudflareGeo(h);
  if (namesAPlace(cloudflareLoc)) return cloudflareLoc;

  // --- tier 2: the configured provider, if we have a real address ----------
  const ip = getClientIp(h);
  if (isUsableIp(ip)) {
    const providerLoc = await lookupIp(ip);
    if (namesAPlace(providerLoc)) return providerLoc;
  }

  // --- tier 3: Vercel's headers, off-Cloudflare only -----------------------
  return behindCloudflare ? null : readVercelGeo(h);
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
