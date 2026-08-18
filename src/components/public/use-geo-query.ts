"use client";

import { useCallback, useMemo } from "react";
import { useLocation } from "@/components/public/location-provider";
import { coordParam, roundCoord } from "@/lib/location";

// The one place a list component turns "where is this visitor" into a refetch.
//
// Every public listing is static ISR: the HTML holds the canonical, unranked
// first page so crawlers and first paint get real content, and the visitor's
// own ordering is applied after hydration by re-querying the API. That handoff
// was written once inside <DoctorListClient> and then not repeated, so
// /hospitals, /specialties/*, /areas and /districts kept serving the canonical
// order to everybody no matter where they were.
//
// Rather than copy those six lines into five components, they live here.
//
// `key` is the value to put in an effect's dependency array. It is a plain
// string on purpose: `location` is a fresh object on every provider render, so
// depending on it directly would refetch the list continuously.

export type GeoQuery = {
  /** Stable dependency value. Empty string until resolution finishes. */
  key: string;
  /** True once we know something worth re-ranking around. */
  hasLocation: boolean;
  /** Resolution has finished (it may still have found nothing). */
  ready: boolean;
  /** Adds preferDistrict / preferLat / preferLng to an outgoing query. */
  apply: (qs: URLSearchParams) => void;
};

export function useGeoQuery(): GeoQuery {
  const { location, ready } = useLocation();

  const districtSlug = location.districtSlug;
  // Rounded here rather than at each call site, so the dependency `key` and the
  // outgoing query string are computed from the SAME value. See roundCoord in
  // src/lib/location.ts for why the precision is dropped at all; the side
  // benefit is that sub-kilometre drift in an IP guess no longer counts as a
  // location change, so the effect below stops refetching over noise.
  const lat = roundCoord(location.lat);
  const lng = roundCoord(location.lng);

  const key = ready ? `${districtSlug ?? ""}:${lat ?? ""}:${lng ?? ""}` : "";
  const hasLocation = useMemo(() => key.replace(/:/g, "") !== "", [key]);

  const apply = useCallback(
    (qs: URLSearchParams) => {
      if (districtSlug) qs.set("preferDistrict", districtSlug);
      const latParam = coordParam(lat);
      const lngParam = coordParam(lng);
      if (latParam !== null) qs.set("preferLat", latParam);
      if (lngParam !== null) qs.set("preferLng", lngParam);
    },
    [districtSlug, lat, lng]
  );

  return { key, hasLocation, ready, apply };
}
