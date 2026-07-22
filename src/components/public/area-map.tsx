"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

// Fixed-aspect container shared by every state so switching from placeholder →
// shimmer → map never triggers a layout shift (CLS).
const CONTAINER_CLASS =
  "relative aspect-square w-full max-w-[420px] overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-[0_14px_34px_rgba(13,148,136,.12)]";

export function AreaMap({ apiKey, initialLat, initialLng }: Props) {
  // Gate Google Maps SDK loading on visibility. The map lives below the fold
  // on the homepage; loading its ~200KB JS eagerly hurts FCP/LCP for no gain.
  const gateRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = gateRef.current;
    if (!el) return;
    // Fallback for very old browsers without IntersectionObserver — load eagerly.
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" } // start loading a bit before it enters the viewport
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  if (!inView) {
    return (
      <div ref={gateRef} className={CONTAINER_CLASS} aria-hidden />
    );
  }

  return (
    <MapInner apiKey={apiKey} initialLat={initialLat} initialLng={initialLng} />
  );
}

function MapInner({ apiKey, initialLat, initialLng }: Props) {
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
    <div className={CONTAINER_CLASS}>
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
