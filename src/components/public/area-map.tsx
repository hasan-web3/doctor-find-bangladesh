"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MAP_CONTAINER_CLASS, type AreaMapProps } from "./area-map-shared";

// Two gates, not one, and they guard different things:
//
//   1. The IntersectionObserver below decides WHEN the map exists at all.
//   2. The dynamic import decides when its CODE is fetched.
//
// Only the first gate used to be here. The Google Maps SDK (the external
// script) was correctly held back until the map scrolled into view, but
// @react-google-maps/api — the 148 KB npm wrapper — was a static import at the
// top of this file, so it shipped in the homepage bundle regardless and was
// downloaded by every visitor including the ones who never scrolled that far.
//
// ssr: false is deliberate and safe here: the map is decoration below the fold,
// it carries no text a crawler needs, and its real centre only ever arrives
// after hydration from <LocationProvider> anyway. Nothing is lost from the
// server-rendered HTML that was not already absent.
const MapInner = dynamic(() => import("./area-map-inner"), {
  ssr: false,
  loading: () => <div className={MAP_CONTAINER_CLASS} aria-hidden />,
});

export function AreaMap({ apiKey, initialLat, initialLng }: AreaMapProps) {
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
    return <div ref={gateRef} className={MAP_CONTAINER_CLASS} aria-hidden />;
  }

  return <MapInner apiKey={apiKey} initialLat={initialLat} initialLng={initialLng} />;
}
