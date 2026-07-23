"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AutoAnimate } from "@/components/auto-animate";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/public/pagination";
import { Reveal } from "@/components/reveal";
import { getDict } from "@/lib/dict";
import { localeHref, num, type Locale } from "@/lib/i18n";
import type { District } from "@/lib/data";
import Link from "next/link";
import { Shimmer } from "@/components/shimmer";

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
  userLat: number | null;
  userLng: number | null;
  locale: Locale;
  initialDistricts: District[];
  initialTotal: number;
};

export function DistrictListClient({ userLat, userLng, locale, initialDistricts, initialTotal }: Props) {
  const [districts, setDistricts] = useState<District[]>(initialDistricts);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(24);
  const [isLoading, setIsLoading] = useState(false);
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);
  const isInitialRender = useRef(true);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (isInitialRender.current && currentPage === 1 && !debouncedQuery) {
      isInitialRender.current = false;
      return;
    }

    const fetchDistricts = async () => {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("locale", locale);
      params.set("page", String(currentPage));
      params.set("perPage", String(perPage));

      if (debouncedQuery) {
        params.set("q", debouncedQuery);
      } else {
        if (userLat) params.set("lat", String(userLat));
        if (userLng) params.set("lng", String(userLng));
      }

      try {
        const res = await fetch(`/api/search/districts?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setDistricts(data.rows || []);
        setTotal(data.total || 0);
      } catch (error) {
        console.error("Failed to fetch districts:", error);
        setDistricts([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDistricts();
  }, [debouncedQuery, currentPage, perPage, userLat, userLng, locale]);

  useEffect(() => {
    if (!isInitialRender.current) {
      setCurrentPage(1);
    }
  }, [debouncedQuery]);
  
  const totalPages = Math.ceil(total / perPage);

  const handlePerPageChange = (newPerPage: number) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
  };

  return (
    <div>
      <div className="mb-8 sticky top-5 z-10">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={d.search_district_placeholder || "Search by District name..."}
            className="w-full pl-12 pr-4 py-4 rounded-full border border-line bg-white shadow-lg focus:ring-2 focus:ring-brand-500 focus:outline-none transition-shadow text-base"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">
            <Icon name="search" />
          </div>
        </div>
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
                href={L(`/districts/${district.slug}`)}
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
            onPageChange={(p) => setCurrentPage(p)}
            onPerPageChange={handlePerPageChange}
            showPerPageSelector={true}
            locale={locale}
          />
        </div>
      )}
    </div>
  );
}
