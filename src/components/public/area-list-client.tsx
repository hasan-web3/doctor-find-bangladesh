"use client";

import { useState, useEffect, useRef } from "react";
import { AutoAnimate } from "@/components/auto-animate";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/public/pagination";
import { usePageParams, useResetPageOnFilterChange } from "@/components/public/use-page-params";
import { ClearSearchButton, SearchResultCount } from "@/components/public/search-meta";
import { Reveal } from "@/components/reveal";
import { getDict } from "@/lib/dict";
import { localeHref, num, type Locale } from "@/lib/i18n";
import type { Area } from "@/lib/data";
import Link from "next/link";
import { Shimmer } from "@/components/shimmer";
import { useGeoQuery } from "@/components/public/use-geo-query";

// A simple debounce hook
function useDebounce(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

type Props = {
  locale: Locale;
  initialAreas: Area[];
  initialTotal: number;
};

// Coordinates used to come in as props from the server, but the page is static
// ISR so they were read off STATIC_GEO and were therefore always null — the
// "nearest thana first" ordering this list advertises never actually ran for
// anybody. They come from <LocationProvider> now, which is the only place on a
// cached page that knows where the visitor is.
export function AreaListClient({ locale, initialAreas, initialTotal }: Props) {
  const [areas, setAreas] = useState<Area[]>(initialAreas);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState("");
  // Page and size come from the URL, which is also what the server used to
  // build `initialAreas` — see usePageParams.
  const { page: currentPage, perPage, resetPage } = usePageParams(24);
  const [isLoading, setIsLoading] = useState(false);
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);
  const isInitialRender = useRef(true);
  const geo = useGeoQuery();

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    // The server already rendered whatever ?page= asked for, so the first pass
    // never needs to refetch — only a search box entry, or a visitor we can
    // actually place, does.
    if (isInitialRender.current && !debouncedQuery) {
      isInitialRender.current = false;
      if (!geo.hasLocation) return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const fetchAreas = async () => {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("locale", locale);
      params.set("page", String(currentPage));
      params.set("perPage", String(perPage));

      if (debouncedQuery) {
        params.set("q", debouncedQuery);
      } else {
        // A text search is the visitor telling us what they want; proximity
        // ordering only applies to the unfiltered list.
        geo.apply(params);
      }

      try {
        const res = await fetch(`/api/search/areas?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (cancelled) return;
        setAreas(data.rows || []);
        setTotal(data.total || 0);
      } catch (error) {
        if ((error as Error)?.name !== "AbortError" && !cancelled) {
          console.error("Failed to fetch areas:", error);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAreas();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, currentPage, perPage, geo.key, locale]);

  // Reset to page 1 when the search text changes (and only then).
  useResetPageOnFilterChange(debouncedQuery, resetPage);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      {/* Search Bar */}
      <div className="mb-8 sticky top-5 z-10">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={d.search_area_placeholder || "Search by Town, Village or District name..."}
            className="w-full pl-12 pr-12 py-4 rounded-full border border-line bg-white shadow-lg focus:ring-2 focus:ring-brand-500 focus:outline-none transition-shadow text-base"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">
            <Icon name="search" />
          </div>
          {query && <ClearSearchButton onClear={() => setQuery("")} label={d.clear_search} className="right-4" />}
        </div>
        <SearchResultCount
          count={total}
          active={Boolean(debouncedQuery)}
          template={d.found_areas}
          locale={locale}
          className="px-1"
        />
      </div>

      {/* Grid of Areas */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 min-[1400px]:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => <Shimmer key={i} className="h-[90px] rounded-2xl" />)}
        </div>
      ) : areas.length > 0 ? (
        <AutoAnimate as="div" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 min-[1400px]:grid-cols-4">
          {areas.map((area, i) => (
            <Reveal key={area.id} delay={Math.min(i * 30, 300)}>
              <Link
                href={L(`/area/doctors/${area.district_slug}/${area.slug}`)}
                className="flex h-full items-center gap-4 rounded-2xl border border-line bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-cardhover"
              >
                <div className="relative flex h-[48px] w-[48px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-brand-50 text-brand-500">
                  ◉
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-heading text-base font-semibold leading-snug text-ink">{area.name}</div>
                  <div className="mt-1 text-sm text-ink-mute">
                    {area.district}
                    {area.doctor_count > 0 ? ` · ${num(area.doctor_count, locale)} ${d.doctors_unit}` : ""}
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </AutoAnimate>
      ) : (
        <div className="text-center py-10">
          <p className="text-lg text-ink-mute">{d.no_search_results || "No areas found matching your search."}</p>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && !isLoading && (
        <div className="mt-8">
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            perPage={perPage}
            showPerPageSelector={true}
            locale={locale}
          />
        </div>
      )}
    </div>
  );
}
