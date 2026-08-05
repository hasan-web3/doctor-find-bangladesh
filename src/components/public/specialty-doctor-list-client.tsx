"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { DoctorCard } from "@/components/public/doctor-card";
import { Pagination } from "@/components/public/pagination";
import { usePageParams, useResetPageOnFilterChange } from "@/components/public/use-page-params";
import { ClearSearchButton, SearchResultCount } from "@/components/public/search-meta";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { getDict } from "@/lib/dict";
import { type Locale } from "@/lib/i18n";
import type { DoctorCardData } from "@/lib/data";
import { Shimmer } from "@/components/shimmer";
import { useGeoQuery } from "@/components/public/use-geo-query";
import { useShownDistrict } from "@/components/public/shown-district-context";

function useDebounce<T>(value: T, delay: number): T {
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
  settings: { helpline: string; helpline_bn: string | null };
  initialDoctors: DoctorCardData[];
  initialTotal: number;
};

export function SpecialtyDoctorListClient({ locale, settings, initialDoctors, initialTotal }: Props) {
  const params = useParams();
  const [parent] = useAutoAnimate();
  const d = getDict(locale);
  const isInitialRender = useRef(true);

  const specialtySlug = typeof params.slug === 'string' ? params.slug : '';

  // State
  const [doctors, setDoctors] = useState<DoctorCardData[]>(initialDoctors);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [nameQuery, setNameQuery] = useState("");
  const { page: currentPage, perPage, resetPage } = usePageParams(12);

  const debouncedNameQuery = useDebounce(nameQuery, 300);
  // Same handoff as /doctors: the cached HTML holds the canonical order, and
  // the visitor's own ordering is applied once the browser knows where they
  // are. This list is the whole point of the page, so it was the most visible
  // place still showing everybody the same ranking.
  const geo = useGeoQuery();
  const { set: setShownDistrict } = useShownDistrict();

  useEffect(() => {
    // Server already rendered the slice named by ?page=...
    if (isInitialRender.current && !debouncedNameQuery) {
      isInitialRender.current = false;
      // ...but with no location, so a visitor we CAN place still needs one
      // requery to get their own ordering.
      if (!geo.hasLocation) return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const fetchDoctors = async () => {
      if (!specialtySlug) return;
      setIsLoading(true);
      const apiParams = new URLSearchParams({
        locale,
        page: String(currentPage),
        perPage: String(perPage),
      });
      if (debouncedNameQuery) {
        apiParams.set("q", debouncedNameQuery);
      }
      geo.apply(apiParams);

      try {
        const res = await fetch(`/api/specialties/${specialtySlug}/doctors?${apiParams.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch doctors");
        const data = await res.json();
        if (cancelled) return;
        setDoctors(data.rows || []);
        setTotal(data.total || 0);
        // Name the district these cards are actually in, so the heading above
        // them cannot claim a different one. Nulls fall back to the server's
        // canonical name rather than blanking it.
        setShownDistrict({
          name: data.rows?.[0]?.district ?? null,
          slug: data.rows?.[0]?.district_slug ?? null,
        });
      } catch (error) {
        if ((error as Error)?.name !== "AbortError" && !cancelled) {
          console.error("Specialty doctor list refetch failed:", error);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchDoctors();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialtySlug, locale, currentPage, perPage, debouncedNameQuery, geo.key, setShownDistrict]);

  // Reset page when the name filter changes (and only then).
  useResetPageOnFilterChange(debouncedNameQuery, resetPage);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="mt-8">
      {/* Filters Section */}
      <div className="mb-8 max-w-lg">
        <label className="mb-1.5 block text-sm font-semibold text-ink-mute">{d.search_by_name || "Search by name"}</label>
        <div className="relative">
          <input
            type="text"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder={d.search_doctor_placeholder || "Enter doctor's name..."}
            className="w-full pl-10 pr-11 py-2.5 rounded-lg border border-line bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none text-base"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
            <Icon name="search" size={18} />
          </div>
          {nameQuery && <ClearSearchButton onClear={() => setNameQuery("")} label={d.clear_search} />}
        </div>
        <SearchResultCount
          count={total}
          active={Boolean(debouncedNameQuery)}
          template={d.found_doctors}
          locale={locale}
        />
      </div>

      {/* Doctor List */}
      <div ref={parent}>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 min-[1400px]:grid-cols-4 gap-5">
            {Array.from({ length: perPage }).map((_, i) => <Shimmer key={i} className="h-[340px] rounded-2xl" />)}
          </div>
        ) : doctors.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 min-[1400px]:grid-cols-4 gap-5">
            {doctors.map((doc, i) => (
              <Reveal key={doc.id} delay={Math.min(i * 40, 400)}>
                <DoctorCard doctor={doc} helpline={settings.helpline} locale={locale} d={d} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border border-dashed rounded-xl">
            <p className="text-lg text-ink-mute">{d.no_doctors_found || "No doctors found matching your criteria."}</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
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
