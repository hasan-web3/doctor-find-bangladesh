"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useShownDistrict } from "@/components/public/shown-district-context";
import { localeHref, type Locale } from "@/lib/i18n";

export type AreaChip = {
  id: number;
  slug: string;
  name: string;
  district_slug: string | null;
};

// The thana chips under "আপনার এলাকার কাছের ডাক্তার খুঁজুন".
//
// These were the most visibly wrong part of a cached homepage: the server names
// the canonical district, so a visitor who picked Khulna was offered আদাবর,
// মিরপুর, হাতিরঝিল — Dhaka thanas — as "areas near you".
//
// The server-rendered chips stay in the HTML for crawlers and first paint; once
// the district on screen is known, this swaps in that district's thanas.

export function HomeAreaChips({
  initialAreas,
  locale,
}: {
  initialAreas: AreaChip[];
  locale: Locale;
}) {
  const { slug } = useShownDistrict();
  const [areas, setAreas] = useState<AreaChip[]>(initialAreas);
  const lastFetched = useRef<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    // The chips already belong to this district (server render, or a previous
    // pass), so there is nothing to fetch.
    if (lastFetched.current === slug) return;
    if (initialAreas[0]?.district_slug === slug && lastFetched.current === null) return;
    lastFetched.current = slug;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/api/districts/${encodeURIComponent(slug)}/areas?locale=${locale}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { rows: AreaChip[] };
        // Keep the existing chips if the district has no thanas with doctors —
        // an empty row would leave a heading with nothing under it.
        if (!cancelled && data.rows.length > 0) setAreas(data.rows);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          console.error("Area chips refetch failed:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [slug, locale, initialAreas]);

  return (
    <div className="flex flex-wrap gap-[9px]">
      {areas.map((a) => (
        <Link
          key={a.id}
          href={localeHref(locale, `/area/doctors/${a.district_slug}/${a.slug}`)}
          className="flex items-center gap-1.5 rounded-full border border-brand-100 bg-white px-4 py-[9px] text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-600 hover:text-white"
        >
          <span className="text-xs">◉</span>
          {a.name}
        </Link>
      ))}
    </div>
  );
}
