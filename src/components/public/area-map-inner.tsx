"use client";

import { useEffect, useMemo, useRef } from "react";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";
import { Shimmer } from "@/components/shimmer";
import { useLocation } from "@/components/public/location-provider";
import { useShownDistrict } from "@/components/public/shown-district-context";
import { MAP_CONTAINER_CLASS, type AreaMapProps } from "./area-map-shared";

// The only module in the public tree that imports @react-google-maps/api —
// 148 KB raw, the second-largest thing on the homepage after the icon set.
// area-map.tsx loads this file lazily once the map scrolls into view, so those
// bytes never touch first paint and never load at all for the visitors who stop
// before reaching it. Keep the import above in this file and nowhere else.

// Where the map should point, resolved entirely in the browser.
//
// Order, and why:
//   1. The visitor's own coordinates. For a district they picked themselves
//      that is the district centre; for an IP guess it is the finer point the
//      provider returned, which is better than any centre we could look up.
//   2. The district the page is actually SHOWING. When the visitor's own
//      district has no doctors, every heading and every thana chip on this
//      section names the substituted district, and a map pointing somewhere
//      else would be the one element contradicting them.
//   3. The server's neutral fallback, which is what crawlers and first paint
//      always see.
function useMapCenter(initialLat: number, initialLng: number) {
  const { location, ready, districtCoords } = useLocation();
  const { slug: shownSlug } = useShownDistrict();

  return useMemo(() => {
    if (ready && location.lat !== null && location.lng !== null) {
      return { lat: location.lat, lng: location.lng };
    }
    const shown = districtCoords(shownSlug);
    if (shown) return shown;
    return { lat: initialLat, lng: initialLng };
  }, [ready, location.lat, location.lng, districtCoords, shownSlug, initialLat, initialLng]);
}

export default function MapInner({ apiKey, initialLat, initialLng }: AreaMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });

  const center = useMapCenter(initialLat, initialLng);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Once the map exists, move it rather than re-mounting it: panTo glides to
  // the new location instead of jumping. `center` is memoised on its own
  // coordinates, so an unrelated re-render produces the same object and this
  // effect does not fire — the visitor's own panning survives.
  useEffect(() => {
    mapRef.current?.panTo(center);
  }, [center]);

  if (!isLoaded) {
    return <Shimmer className="aspect-square w-full max-w-[420px] rounded-3xl" />;
  }

  return (
    <div className={MAP_CONTAINER_CLASS}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={11}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        onUnmount={() => {
          mapRef.current = null;
        }}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          styles: [
            // Basic styles to declutter the map
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        }}
      >
        <MarkerF position={center} />
      </GoogleMap>
    </div>
  );
}
