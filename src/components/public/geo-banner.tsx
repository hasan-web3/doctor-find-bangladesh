"use client";

import type { Dict } from "@/lib/dict";

// The quieter of the two asks. Shown after the district modal has been
// dismissed without an answer, and only while the location is still a guess.
//
// Two shapes, depending on whether IP geo gave us anything:
//   • a guess to correct  — "আপনি সম্ভবত ঢাকা থেকে দেখছেন…" + পরিবর্তন করুন
//   • nothing at all      — a plain invitation to pick a district
// The second exists because the strip is the visitor's only way back to the
// picker once the modal is dismissed; without it, anyone we cannot geolocate
// (VPN, unknown ISP, local dev) would lose the entrance entirely.
//
// Visibility, dismissal and the back-off timers all live in <GeoPrompt>; this
// component is purely the strip so both surfaces can share one state machine
// instead of racing each other through localStorage.
export function GeoBanner({
  districtName,
  onChange,
  onDismiss,
  d,
}: {
  /** District granularity only. A thana name here would overstate what an IP
   *  lookup can actually tell us, and the visitor can only correct us at
   *  district level anyway. Null when IP geo yielded nothing. */
  districtName: string | null;
  onChange: () => void;
  onDismiss: () => void;
  d: Pick<
    Dict,
    "geo_viewing_from" | "geo_viewing_suffix" | "geo_change" | "geo_unknown" | "geo_choose_district"
  >;
}) {
  return (
    <div className="border-b border-brand-100 bg-brand-50">
      <div className="mx-auto flex max-w-site flex-wrap items-center justify-center gap-x-3 gap-y-2 px-5 py-2 text-[13.5px] text-brand-700">
        <span>
          <span className="mr-1">◉</span>
          {districtName ? (
            <>
              {d.geo_viewing_from} <b>{districtName}</b>
              {d.geo_viewing_suffix}
            </>
          ) : (
            d.geo_unknown
          )}
        </span>
        <button onClick={onChange} className="font-bold underline underline-offset-2">
          {districtName ? d.geo_change : d.geo_choose_district}
        </button>
        <button onClick={onDismiss} aria-label="বন্ধ করুন" className="text-brand-600">
          ✕
        </button>
      </div>
    </div>
  );
}
