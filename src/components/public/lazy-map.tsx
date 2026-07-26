"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

// Renders a lightweight placeholder until the visitor asks for the map.
// A Google Maps iframe pulls ~1-2 MB of JS + tiles; when placed above the
// fold it becomes the LCP element on mobile. Deferring it behind a click
// keeps LCP fast for the majority who never zoom the map.
export function LazyMap({
  src,
  title,
  loadLabel,
  heightClass = "h-[260px] sm:h-[340px] min-[900px]:h-[380px]",
}: {
  src: string;
  title: string;
  loadLabel: string;
  heightClass?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <iframe
        title={title}
        src={src}
        className={`${heightClass} w-full border-0`}
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      aria-label={loadLabel}
      className={`group flex ${heightClass} w-full flex-col items-center justify-center gap-2.5 bg-gradient-to-br from-brand-50 via-white to-brand-50 text-brand-700 transition-colors hover:from-brand-100 hover:to-brand-100`}
    >
      <MapPin size={40} strokeWidth={1.75} className="text-brand-500 transition-transform group-hover:scale-110" />
      <span className="text-[15px] font-semibold">{loadLabel}</span>
    </button>
  );
}
