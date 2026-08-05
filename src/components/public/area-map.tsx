"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";
import { Shimmer } from "@/components/shimmer";
import { useLocation } from "@/components/public/location-provider";
import { useShownDistrict } from "@/components/public/shown-district-context";

type Props = {
  apiKey: string;
  // The neutral fallback centre baked into the cached HTML. The page is static
  // ISR — one document serves everybody — so the server cannot know where the
  // visitor is and must not try; this pair is the site's default view.
  //
  // The real centre arrives after hydration from <LocationProvider>, which is
  // where the visitor's chosen district or the IP guess lives. We still do not
  // call navigator.geolocation: the site Permissions-Policy allows it (see
  // next.config.ts) but a permission prompt for a decorative homepage map is
  // not a trade worth making.
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

function MapInner({ apiKey, initialLat, initialLng }: Props) {
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
    <div className={CONTAINER_CLASS}>
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
