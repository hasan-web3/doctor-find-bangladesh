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
import type { District } from "@/lib/data";
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
  initialDistricts: District[];
  initialTotal: number;
};

// Same story as <AreaListClient>: the coordinates used to arrive as props read
// off STATIC_GEO on a cached page, so they were always null and the nearest-
// first ordering never ran. They come from <LocationProvider> now.
export function DistrictListClient({ locale, initialDistricts, initialTotal }: Props) {
  const [districts, setDistricts] = useState<District[]>(initialDistricts);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState("");
  const { page: currentPage, perPage, resetPage } = usePageParams(24);
  const [isLoading, setIsLoading] = useState(false);
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);
  const isInitialRender = useRef(true);
  const geo = useGeoQuery();

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    // Server already rendered the slice named by ?page=; only a search box
    // entry, or a visitor we can actually place, needs a first-pass refetch.
    if (isInitialRender.current && !debouncedQuery) {
      isInitialRender.current = false;
      if (!geo.hasLocation) return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const fetchDistricts = async () => {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("locale", locale);
      params.set("page", String(currentPage));
      params.set("perPage", String(perPage));

      if (debouncedQuery) {
        params.set("q", debouncedQuery);
      } else {
        geo.apply(params);
      }

      try {
        const res = await fetch(`/api/search/districts?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (cancelled) return;
        setDistricts(data.rows || []);
        setTotal(data.total || 0);
      } catch (error) {
        if ((error as Error)?.name !== "AbortError" && !cancelled) {
          console.error("Failed to fetch districts:", error);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchDistricts();
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
      <div className="mb-8 sticky top-5 z-10">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={d.search_district_placeholder || "Search by District name..."}
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
          template={d.found_districts}
          locale={locale}
          className="px-1"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 min-[1400px]:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => <Shimmer key={i} className="h-[90px] rounded-2xl" />)}
        </div>
      ) : districts.length > 0 ? (
        <AutoAnimate as="div" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 min-[1400px]:grid-cols-4">
          {districts.map((district, i) => (
            <Reveal key={district.id} delay={Math.min(i * 30, 300)}>
              <Link
                href={L(`/districts/${district.slug}/doctors`)}
                className="flex h-full items-center gap-4 rounded-2xl border border-line bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-cardhover"
              >
                <div className="relative flex h-[48px] w-[48px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-brand-50 text-brand-500">
                  ◉
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-heading text-base font-semibold leading-snug text-ink">{district.name}</div>
                  <div className="mt-1 text-sm text-ink-mute">
                    {district.doctor_count > 0 ? `${num(district.doctor_count, locale)} ${d.doctors_unit}` : ""}
                    {district.thana_count > 0 ? ` · ${num(district.thana_count, locale)} ${d.nav_areas}` : ""}
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </AutoAnimate>
      ) : (
        <div className="text-center py-10">
          <p className="text-lg text-ink-mute">{d.no_search_results || "No districts found matching your search."}</p>
        </div>
      )}

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
