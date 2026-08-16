"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DoctorCard } from "@/components/public/doctor-card";
import { Reveal } from "@/components/reveal";
import { Shimmer } from "@/components/shimmer";
import { useLocation } from "@/components/public/location-provider";
import { useShownDistrict } from "@/components/public/shown-district-context";
import { withPossessive } from "@/lib/bn";
import { localeHref, type Locale } from "@/lib/i18n";
import type { DoctorCardData } from "@/lib/data";
import type { Dict } from "@/lib/dict";

// The homepage's featured-doctor section.
//
// The page is static ISR: one cached document serves every visitor and every
// crawler, and the server has no idea where the visitor is. This component
// re-personalises the section after hydration, from the district the visitor
// chose (or the IP hint) held in LocationProvider.
//
// The HEADING lives in here with the cards on purpose. Leaving it on the server
// would pin it to the canonical district, so a Dhaka visitor would read
// "খুলনার জনপ্রিয় ডাক্তার" above a grid of Dhaka doctors. The original
// server-rendered code was careful that every heading matched the cards under
// it; moving one without the other would break exactly that.
//
// `initialDoctors` is the server-rendered canonical list, so the HTML always
// ships real doctor cards — first paint and Googlebot both see content, and a
// visitor who has not chosen a district never triggers a request.

export function HomeDoctorRail({
  initialDoctors,
  canonicalDistrictName,
  locale,
  d,
  helpline,
}: {
  initialDoctors: DoctorCardData[];
  /** District named in the server-rendered HTML; the fallback until we know better. */
  canonicalDistrictName: string | null;
  locale: Locale;
  d: Dict;
  helpline: string;
}) {
  const { location, ready } = useLocation();
  // This rail is the only component on the homepage that actually queries
  // doctors, so it is the one that knows which district the page is really
  // showing. It publishes that to the shared context; the hero copy, the area
  // section and the chips all read it back, which is what keeps every place
  // name on the page agreeing with the cards.
  //
  // Never set from `location` directly: when the visitor's district turns out
  // to have no doctors we keep the canonical cards, and the copy has to keep
  // naming the canonical district with them. Deriving it straight from
  // `location` printed "ঢাকার জনপ্রিয় ডাক্তার" over Khulna cards.
  const { name: shownDistrictName, set: setShownDistrict } = useShownDistrict();
  const [doctors, setDoctors] = useState<DoctorCardData[]>(initialDoctors);
  const [loading, setLoading] = useState(false);
  const lastFetched = useRef<string | null>(null);

  const districtSlug = ready ? location.districtSlug : null;

  useEffect(() => {
    // No district known yet (fresh visitor, or outside our coverage): the
    // canonical list already on screen is the right answer.
    if (!districtSlug) return;
    // Don't refetch the same district twice, e.g. on an unrelated re-render.
    if (lastFetched.current === districtSlug) return;
    lastFetched.current = districtSlug;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      const qs = new URLSearchParams({
        locale,
        perPage: String(initialDoctors.length || 20),
        preferDistrict: districtSlug,
      });
      if (location.lat !== null) qs.set("preferLat", String(location.lat));
      if (location.lng !== null) qs.set("preferLng", String(location.lng));

      try {
        const res = await fetch(`/api/doctors?${qs.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { rows: DoctorCardData[] };
        // An empty result means this district has no doctors. Keep the canonical
        // list AND its heading rather than blanking the busiest section on the
        // homepage — the substitution notice in <GeoShell> is what explains to
        // the visitor why they are seeing another district's doctors.
        if (!cancelled && data.rows.length > 0) {
          setDoctors(data.rows);
          // Name the district the RESULTS are in, never the one the visitor is
          // in. `preferDistrict` is a ranking preference, not a filter: a
          // Bagerhat visitor gets Khulna doctors ordered by proximity, so
          // naming Bagerhat would caption Khulna cards with the wrong district.
          // Same rule resolveDisplayDistrict applies on the server.
          setShownDistrict({
            name: data.rows[0]?.district ?? null,
            slug: data.rows[0]?.district_slug ?? null,
          });
        }
      } catch (err) {
        // Aborted requests are routine; anything else leaves the existing cards
        // in place, which is always better than an empty homepage.
        if ((err as Error)?.name !== "AbortError") {
          console.error("Homepage doctor rail refetch failed:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [districtSlug, location.lat, location.lng, locale, initialDoctors.length, setShownDistrict]);

  const districtName = shownDistrictName ?? canonicalDistrictName;

  const title = districtName
    ? locale === "bn"
      ? `${withPossessive(districtName)} জনপ্রিয় ও যাচাইকৃত ডাক্তার`
      : `Popular & verified doctors in ${districtName}`
    : locale === "bn"
      ? "আপনার এলাকার জনপ্রিয় ও যাচাইকৃত ডাক্তার"
      : "Popular & verified doctors in your area";

  return (
    <div className="mx-auto max-w-site px-5 py-16">
      <Reveal>
        <div className="mb-[30px] flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 text-sm font-bold text-brand-600">{d.sec_featured_eyebrow}</div>
            <h2 className="m-0 font-heading text-[clamp(26px,3.5vw,32px)] font-bold text-ink">{title}</h2>
          </div>
          <Link
            href={localeHref(locale, "/doctors")}
            className="rounded-[10px] border-[1.5px] border-brand-600 bg-white px-[18px] py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
          >
            {d.view_all_doctors}
          </Link>
        </div>
      </Reveal>

      {loading ? (
        // Same grid shape as the cards, so swapping in the new list cannot
        // shift the page around the visitor mid-read.
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 min-[1000px]:grid-cols-4">
          {Array.from({ length: Math.min(doctors.length || 4, 8) }).map((_, i) => (
            <Shimmer key={i} className="h-[260px] rounded-2xl" />
          ))}
        </div>
      ) : doctors.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 min-[1000px]:grid-cols-4">
          {doctors.map((doc, i) => (
            <Reveal key={doc.id} delay={Math.min(i * 60, 240)}>
              <DoctorCard doctor={doc} helpline={helpline} locale={locale} d={d} />
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-ink-faint">
          {d.no_doctors_yet}
        </div>
      )}
    </div>
  );
}
