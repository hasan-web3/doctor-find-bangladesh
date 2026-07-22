"use client";

import { useMemo } from "react";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";
import { Shimmer } from "@/components/shimmer";

type Props = {
  apiKey: string;
  // Initial center, from server-side IP lookup. This is the ONLY source of
  // location — we intentionally do not call navigator.geolocation because the
  // site Permissions-Policy blocks it (see next.config.ts) and IP-based geo
  // is already accurate enough for the decorative map on the homepage.
  initialLat: number;
  initialLng: number;
};

export function AreaMap({ apiKey, initialLat, initialLng }: Props) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });

  const center = useMemo(
    () => ({ lat: initialLat, lng: initialLng }),
    [initialLat, initialLng]
  );

  if (!isLoaded) {
    return <Shimmer className="aspect-square w-full max-w-[420px] rounded-3xl" />;
  }

  return (
    <div className="relative aspect-square w-full max-w-[420px] overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-[0_14px_34px_rgba(13,148,136,.12)]">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={center}
        zoom={11}
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
