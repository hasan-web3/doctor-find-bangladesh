// Shared by the visibility gate (area-map.tsx) and the real map
// (area-map-inner.tsx). It lives in its own module on purpose: the gate must be
// able to reserve the exact box WITHOUT importing anything that reaches
// @react-google-maps/api, and a constant in either component file would drag
// that file — and its 148 KB dependency — into the initial bundle.
//
// Fixed aspect so placeholder → shimmer → map never shifts layout (CLS).
export const MAP_CONTAINER_CLASS =
  "relative aspect-square w-full max-w-[420px] overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-[0_14px_34px_rgba(13,148,136,.12)]";

export type AreaMapProps = {
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
