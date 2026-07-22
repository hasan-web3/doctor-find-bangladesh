// Google Maps embed URL / iframe -> { lat, lng }.
//
// The admin form accepts either the full <iframe ...src="..."></iframe> tag,
// the bare embed URL, or a maps.app.goo.gl short link. This helper handles
// every shape so the same function can auto-fill the lat/lng fields in the
// client AND validate them in the server action.
//
// Google Maps embed encodes coordinates two ways we can parse without a
// network hop:
//   1. `!1d{zoom}!2d{lng}!3d{lat}!` inside the `?pb=` polyline (embed URLs)
//   2. `@{lat},{lng},{zoom}z`      (share URLs, /maps/place/…)
// Short links (maps.app.goo.gl) resolve to one of the above only after a
// redirect, so we return null and leave the field for manual entry.

export type LatLng = { lat: number; lng: number };

const NUM = "(-?\\d+(?:\\.\\d+)?)";

const PB_RE = new RegExp(`!2d${NUM}!3d${NUM}`);
const AT_RE = new RegExp(`@${NUM},${NUM}`);

// Extract the src of an iframe if the input looks like a full <iframe> tag,
// otherwise return the input unchanged.
function unwrapIframe(input: string): string {
  const m = input.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  return m ? m[1].trim() : input;
}

export function parseLatLng(rawInput: string): LatLng | null {
  const raw = (rawInput || "").trim();
  if (!raw) return null;
  const url = unwrapIframe(raw);

  const pb = url.match(PB_RE);
  if (pb) {
    const lng = Number(pb[1]);
    const lat = Number(pb[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  const at = url.match(AT_RE);
  if (at) {
    const lat = Number(at[1]);
    const lng = Number(at[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  return null;
}
