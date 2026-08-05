// Client-safe location contract.
//
// Deliberately has NO "server-only" import and NO database access: this module
// is pulled into the browser bundle by <LocationProvider>. `src/lib/geo.ts`
// stays server-only and re-exports the cookie constants from here so the two
// halves can never drift apart.
//
// Why this exists at all: every public page used to resolve the visitor's area
// on the SERVER via cookies() + headers(). That made all 24 public routes
// `ƒ Dynamic` and put a full React render on Vercel's CPU meter for every hit,
// including crawlers. The pages now render one canonical, cacheable HTML
// document and the visitor's own location is applied here, after hydration.

// The visitor's own district answer. 30 days: long enough that we ask at most
// once a month, short enough that someone who genuinely moves isn't stuck.
export const DISTRICT_COOKIE = "db_district";
export const DISTRICT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

// Transient thana pick. Short-lived on purpose (see chooseArea in
// src/actions/public.ts) — it survives one navigation, not a session.
export const AREA_COOKIE = "db_area";

// Where an IP-derived guess is parked so we ask the network at most once per
// visitor per TTL, instead of once per page view.
export const IP_CACHE_KEY = "db_ip_location";
export const IP_CACHE_TTL_MS = 30 * 60 * 1000;

// Bumped whenever the SERVER's detection changes shape or accuracy. Without it
// a visitor who was mislocated before a fix kept being served the wrong answer
// out of their own localStorage for another half hour, with no way to clear it
// except waiting — the fix shipped and nothing visibly changed for them.
// Entries stamped with anything other than the current version are a miss.
export const IP_CACHE_VERSION = 2;

export type LocationSource =
  /** The visitor picked a district themselves. Outranks everything. */
  | "manual"
  /** Inferred from IP. A hint for ordering and prompts, never an answer. */
  | "ip"
  /** Nothing known yet, or the visitor is outside our coverage. */
  | "none";

export type ClientLocation = {
  districtSlug: string | null;
  districtName: string | null;
  areaSlug: string | null;
  areaName: string | null;
  lat: number | null;
  lng: number | null;
  source: LocationSource;
};

export const EMPTY_LOCATION: ClientLocation = {
  districtSlug: null,
  districtName: null,
  areaSlug: null,
  areaName: null,
  lat: null,
  lng: null,
  source: "none",
};

// Haversine distance in km — good enough for "which district is closest".
// Lives here rather than in the server-only geo.ts because the browser now
// does this ranking itself (the server no longer knows where the visitor is).
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

// ---------------------------------------------------------------------------
// cookie helpers (browser only)
// ---------------------------------------------------------------------------
// A cookie rather than localStorage for the district choice, because the value
// is also read by server actions and by /api/user/location. `chooseDistrict`
// writes it with httpOnly:false precisely so this side can see it too.

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length)) || null;
      } catch {
        return part.slice(prefix.length) || null;
      }
    }
  }
  return null;
}

export function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax${secure}`;
}

export function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

// ---------------------------------------------------------------------------
// IP-guess cache (localStorage, TTL'd)
// ---------------------------------------------------------------------------
// Safari private mode throws on storage access, so every path here fails soft:
// a thrown read is treated as a cache miss, which costs one extra API call and
// never breaks the page.

export function readCachedIpLocation(): ClientLocation | null {
  try {
    const raw = window.localStorage.getItem(IP_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value: ClientLocation; expires: number; v?: number };
    // A missing or older `v` is an answer from a build whose detection we no
    // longer trust. Drop it and ask again rather than replaying it.
    if (parsed?.v !== IP_CACHE_VERSION) {
      window.localStorage.removeItem(IP_CACHE_KEY);
      return null;
    }
    if (!parsed?.expires || parsed.expires <= Date.now()) {
      window.localStorage.removeItem(IP_CACHE_KEY);
      return null;
    }
    // A cached "we don't know" is not worth replaying either: it suppresses the
    // one request that could resolve it, for half an hour, on every page view.
    if (!parsed.value || parsed.value.source === "none") {
      window.localStorage.removeItem(IP_CACHE_KEY);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

export function writeCachedIpLocation(value: ClientLocation) {
  // Never park an empty answer (see readCachedIpLocation): the next navigation
  // should get a fresh chance at the lookup.
  if (value.source === "none") return;
  try {
    window.localStorage.setItem(
      IP_CACHE_KEY,
      JSON.stringify({ value, expires: Date.now() + IP_CACHE_TTL_MS, v: IP_CACHE_VERSION })
    );
  } catch {
    /* storage unavailable — we simply ask again next visit */
  }
}

export function clearCachedIpLocation() {
  try {
    window.localStorage.removeItem(IP_CACHE_KEY);
  } catch {
    /* nothing to do */
  }
}
