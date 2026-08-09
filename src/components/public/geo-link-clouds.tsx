"use client";

import { useEffect, useRef, useState } from "react";
import { LinkCloud } from "@/components/public/link-cloud";
import { useShownDistrict } from "@/components/public/shown-district-context";
import { localeHref, type Locale } from "@/lib/i18n";
import type { HubLink } from "@/lib/data";
import type { Dict } from "@/lib/dict";

export type DistrictHub = {
  thanas: HubLink[];
  specialties: HubLink[];
  hospitals: HubLink[];
};

// ---------------------------------------------------------------------------
// The SEO link blocks under a listing, following the district on screen.
// ---------------------------------------------------------------------------
// The page they sit on is static ISR: one cached HTML for every visitor and for
// Googlebot. The server renders the CANONICAL district's blocks into that HTML,
// so a crawl always sees a complete, internally consistent page and first paint
// never waits on a request.
//
// After hydration this follows <ShownDistrictProvider>, which is published by
// the doctor list itself. That is the right signal rather than the visitor's
// raw location, and the difference matters: `preferDistrict` on /api/doctors
// RANKS, it does not filter, so a visitor in a district with no doctors still
// sees the nearest district's cards. Following the list means these blocks name
// the same place the cards do, instead of offering thanas from a district that
// has nothing to show. That is exactly the "their own area first, otherwise the
// nearest one" behaviour the rest of the site already has.
//
// Load cost is bounded on purpose: ONE request, only when the district actually
// changes, answered from the CDN, and capped server-side. Never all districts.
// ---------------------------------------------------------------------------

export function GeoLinkClouds({
  initial,
  canonicalDistrictName,
  canonicalDistrictSlug,
  locale,
  d,
}: {
  /** Server-rendered blocks for the canonical district. Stays in the cached HTML. */
  initial: DistrictHub;
  canonicalDistrictName: string | null;
  canonicalDistrictSlug: string | null;
  locale: Locale;
  d: Pick<
    Dict,
    | "hub_areas_title_tpl" | "hub_areas_desc"
    | "hub_specialties_title_tpl" | "hub_specialties_desc"
    | "hub_hospitals_title_tpl" | "hub_hospitals_desc"
    | "view_all_areas" | "view_all_specialties" | "view_all_hospitals"
    | "doctors_unit"
  >;
}) {
  const { name: shownName, slug: shownSlug } = useShownDistrict();
  const [hub, setHub] = useState<DistrictHub>(initial);
  // Which district `hub` currently describes. Starts at the canonical one so a
  // list that publishes the same district never triggers a pointless fetch.
  const loadedFor = useRef<string | null>(canonicalDistrictSlug);

  useEffect(() => {
    if (!shownSlug || shownSlug === loadedFor.current) return;
    loadedFor.current = shownSlug;

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/districts/${encodeURIComponent(shownSlug)}/hub?locale=${locale}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as DistrictHub;
        // Keep the server's blocks if the new district has nothing to show. An
        // empty swap would replace three useful sections with three headings
        // over nothing, which is worse than naming a nearby district.
        const empty =
          data.thanas.length === 0 &&
          data.specialties.length === 0 &&
          data.hospitals.length === 0;
        if (!cancelled && !empty) setHub(data);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          console.error("District hub refetch failed:", err);
          // Roll back so a transient failure can be retried on the next change.
          loadedFor.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [shownSlug, locale]);

  const districtName = shownName || canonicalDistrictName;
  // Without a district name the headings would read "Doctors by Area in" with
  // nothing after it, so the whole group waits until there is one to print.
  if (!districtName) return null;

  const L = (path: string) => localeHref(locale, path);
  const fill = (tpl: string) => tpl.replace("{d}", districtName);

  return (
    <>
      <LinkCloud
        title={fill(d.hub_areas_title_tpl)}
        description={d.hub_areas_desc}
        items={hub.thanas}
        href={(a) => L(`/area/doctors/${a.district_slug}/${a.slug}`)}
        locale={locale}
        countSuffix={d.doctors_unit}
        limit={30}
        moreHref={L("/areas")}
        moreLabel={d.view_all_areas}
      />
      <LinkCloud
        title={fill(d.hub_specialties_title_tpl)}
        description={d.hub_specialties_desc}
        items={hub.specialties}
        href={(s) => L(`/specialties/${s.slug}`)}
        locale={locale}
        countSuffix={d.doctors_unit}
        limit={30}
        moreHref={L("/specialties")}
        moreLabel={d.view_all_specialties}
      />
      <LinkCloud
        title={fill(d.hub_hospitals_title_tpl)}
        description={d.hub_hospitals_desc}
        items={hub.hospitals}
        href={(h) => L(`/hospitals/${h.slug}`)}
        locale={locale}
        countSuffix={d.doctors_unit}
        limit={20}
        moreHref={L("/hospitals")}
        moreLabel={d.view_all_hospitals}
      />
    </>
  );
}
