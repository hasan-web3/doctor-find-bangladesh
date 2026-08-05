"use client";

import { useCallback, useMemo } from "react";
import { useLocation } from "@/components/public/location-provider";

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
  const lat = location.lat;
  const lng = location.lng;

  const key = ready ? `${districtSlug ?? ""}:${lat ?? ""}:${lng ?? ""}` : "";
  const hasLocation = useMemo(() => key.replace(/:/g, "") !== "", [key]);

  const apply = useCallback(
    (qs: URLSearchParams) => {
      if (districtSlug) qs.set("preferDistrict", districtSlug);
      if (lat !== null) qs.set("preferLat", String(lat));
      if (lng !== null) qs.set("preferLng", String(lng));
    },
    [districtSlug, lat, lng]
  );

  return { key, hasLocation, ready, apply };
}
