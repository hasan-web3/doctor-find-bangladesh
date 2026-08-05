"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DISTRICT_COOKIE,
  DISTRICT_COOKIE_MAX_AGE,
  AREA_COOKIE,
  EMPTY_LOCATION,
  clearCachedIpLocation,
  deleteCookie,
  readCachedIpLocation,
  readCookie,
  writeCachedIpLocation,
  writeCookie,
  type ClientLocation,
} from "@/lib/location";
import type { Locale } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// The visitor's location, resolved entirely in the browser.
// ---------------------------------------------------------------------------
// Resolution order, highest authority first:
//
//   1. `db_district` cookie — the visitor answered the district prompt. A
//      stated district beats an inferred one even when the IP disagrees, which
//      is the whole reason the prompt exists: IP geolocation resolves to the
//      ISP's exit node, not the person, so a Khulna visitor on a Dhaka-routed
//      provider would otherwise be told "Dhaka" forever.
//      Costs ZERO network requests — the district list is already in props.
//
//   2. localStorage IP cache — a previous answer from tier 3, good for 30 min.
//
//   3. GET /api/user/location — Vercel edge geo headers, or an external IP-geo
//      provider when those are absent (local dev / self-hosted).
//
// `ready` starts false and the value starts EMPTY so the first client render
// matches the server-rendered HTML exactly. Anything that would shift layout
// must wait for `ready`, or hydration mismatches and CLS follow.

export type LocationContextValue = {
  location: ClientLocation;
  /** False until resolution finishes. Gate layout-affecting UI on this. */
  ready: boolean;
  /** Persist a district the visitor picked, and re-resolve immediately. */
  setDistrict: (slug: string) => void;
  /** Forget the stored answer and fall back to the IP guess. */
  clearDistrict: () => void;
  /**
   * Coordinates for any district we serve. The server already ships this list
   * inside the cached HTML, so a consumer that needs to point at a district on
   * a map costs no request and no extra bytes.
   */
  districtCoords: (slug: string | null) => { lat: number; lng: number } | null;
};

const LocationContext = createContext<LocationContextValue>({
  location: EMPTY_LOCATION,
  ready: false,
  setDistrict: () => {},
  clearDistrict: () => {},
  districtCoords: () => null,
});

export function useLocation(): LocationContextValue {
  return useContext(LocationContext);
}

/** Minimal district shape the provider needs to resolve a cookie to a name. */
export type ProviderDistrict = {
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
};

export function LocationProvider({
  districts,
  locale,
  children,
}: {
  /**
   * Server-rendered from the `unstable_cache`d district list. Identical for
   * every visitor, so it stays part of the cacheable HTML payload and lets
   * tier 1 resolve without a round trip.
   */
  districts: ProviderDistrict[];
  locale: Locale;
  children: React.ReactNode;
}) {
  const [location, setLocation] = useState<ClientLocation>(EMPTY_LOCATION);
  const [ready, setReady] = useState(false);
  // Bumped to force the resolve effect to run again. `clearDistrict` used to
  // delete the cookie and flip `ready` back and forth, but neither of the
  // effect's dependencies changed, so tier 2/3 never re-ran and the visitor was
  // left with no location at all until they reloaded the page by hand.
  const [resolveNonce, setResolveNonce] = useState(0);

  const fromDistrictSlug = useCallback(
    (slug: string): ClientLocation | null => {
      const hit = districts.find((x) => x.slug === slug);
      if (!hit) return null;
      // areaSlug stays null on purpose: we know their district, we do NOT know
      // their thana, and guessing one re-introduces the false precision the
      // district prompt exists to remove.
      return {
        districtSlug: hit.slug,
        districtName: hit.name,
        areaSlug: null,
        areaName: null,
        lat: hit.lat,
        lng: hit.lng,
        source: "manual",
      };
    },
    [districts]
  );

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      // --- tier 1: the visitor's own answer -------------------------------
      const chosen = readCookie(DISTRICT_COOKIE);
      if (chosen) {
        const manual = fromDistrictSlug(chosen);
        if (manual) {
          if (!cancelled) {
            setLocation(manual);
            setReady(true);
          }
          return;
        }
        // Cookie points at a district we no longer serve (renamed or removed).
        // Drop it rather than letting a dead slug suppress the prompt forever.
        deleteCookie(DISTRICT_COOKIE);
      }

      // --- tier 2: a recent IP answer we already paid for ------------------
      const cached = readCachedIpLocation();
      if (cached) {
        if (!cancelled) {
          setLocation(cached);
          setReady(true);
        }
        return;
      }

      // --- tier 3: ask the network ----------------------------------------
      try {
        const res = await fetch(`/api/user/location?locale=${locale}`, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as ClientLocation;
        writeCachedIpLocation(data);
        if (!cancelled) setLocation(data);
      } catch {
        // Offline, blocked by an extension, or the endpoint failed. "We don't
        // know" is a valid state — the prompt simply asks without a guess to
        // pre-fill, which is exactly what it does for a first-time visitor.
        if (!cancelled) setLocation(EMPTY_LOCATION);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [fromDistrictSlug, locale, resolveNonce]);

  const setDistrict = useCallback(
    (slug: string) => {
      const manual = fromDistrictSlug(slug);
      if (!manual) return;
      writeCookie(DISTRICT_COOKIE, slug, DISTRICT_COOKIE_MAX_AGE);
      // A stale thana pick outranks the district cookie server-side, so a fresh
      // district answer has to clear it or the new choice does nothing.
      deleteCookie(AREA_COOKIE);
      // The IP guess is now irrelevant and would resurface if the district
      // cookie were ever cleared mid-session.
      clearCachedIpLocation();
      setLocation(manual);
      setReady(true);
    },
    [fromDistrictSlug]
  );

  const clearDistrict = useCallback(() => {
    deleteCookie(DISTRICT_COOKIE);
    deleteCookie(AREA_COOKIE);
    clearCachedIpLocation();
    setLocation(EMPTY_LOCATION);
    // Back to "resolving": the bump below re-enters the effect, which walks
    // tiers 1-3 again and sets `ready` when it lands. Flipping `ready` true
    // here instead is what used to strand the visitor with an empty location.
    setReady(false);
    setResolveNonce((n) => n + 1);
  }, []);

  const districtCoords = useCallback(
    (slug: string | null) => {
      if (!slug) return null;
      const hit = districts.find((x) => x.slug === slug);
      if (!hit || hit.lat === null || hit.lng === null) return null;
      return { lat: hit.lat, lng: hit.lng };
    },
    [districts]
  );

  const value = useMemo<LocationContextValue>(
    () => ({ location, ready, setDistrict, clearDistrict, districtCoords }),
    [location, ready, setDistrict, clearDistrict, districtCoords]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}
