"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { SearchableMultiSelect, type Option } from "@/components/admin/searchable-select";
import { DoctorCard } from "@/components/public/doctor-card";
import { Pagination } from "@/components/public/pagination";
import { usePageParams, useResetPageOnFilterChange, useUrlSearchParams } from "@/components/public/use-page-params";
import { ClearSearchButton, SearchResultCount } from "@/components/public/search-meta";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { getDict } from "@/lib/dict";
import { t, type Locale } from "@/lib/i18n";
import type { DoctorCardData, Specialty } from "@/lib/data";
import { Shimmer } from "@/components/shimmer";

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
  districtSlug: string;
  areaSlug: string;
  allSpecialties: Specialty[];
  locale: Locale;
  settings: { helpline: string; helpline_bn: string | null };
  initialDoctors: DoctorCardData[];
  initialTotal: number;
};

export function AreaDoctorListClient({ districtSlug, areaSlug, allSpecialties, locale, settings, initialDoctors, initialTotal }: Props) {
  const searchParams = useUrlSearchParams();
  const [parent] = useAutoAnimate();
  const d = getDict(locale);
  const isInitialRender = useRef(true);

  // State
  const [doctors, setDoctors] = useState<DoctorCardData[]>(initialDoctors);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [nameQuery, setNameQuery] = useState(searchParams.get("q") || "");
  const [selectedSpecialtySlugs, setSelectedSpecialtySlugs] = useState<string[]>(searchParams.getAll("specialty"));
  // Page stays bound to the URL rather than being copied into state once on
  // mount, so the pager can be real links and stays correct on back/forward.
  const { page: currentPage, perPage, resetPage } = usePageParams(12);

  const debouncedNameQuery = useDebounce(nameQuery, 300);

  // Convert specialties to options for the dropdown.
  //
  // `label_en` is searched but never rendered by SearchableMultiSelect, so we
  // put the name in the OTHER language there: that makes typing "medicine"
  // find "মেডিসিন" on the Bangla page and vice versa on the English one.
  // (Despite the field name it is just an extra search key here.)
  const specialtyOptions = useMemo(() => {
    const alt: Locale = locale === "bn" ? "en" : "bn";
    return allSpecialties.map((s) => {
      const altName = t(s.name_ml, alt);
      return {
        id: s.id,
        label: s.name,
        label_en: altName && altName !== s.name ? altName : null,
        sub: s.slug,
      };
    });
  }, [allSpecialties, locale]);
  const idToSpecialtySlug = useMemo(
    () => new Map(allSpecialties.map((s) => [s.id, s.slug])),
    [allSpecialties]
  );
  const slugToSpecialtyId = useMemo(
    () => new Map(allSpecialties.map((s) => [s.slug, s.id])),
    [allSpecialties]
  );
  
  useEffect(() => {
    // Skip fetch on initial render if no filters are applied, because we have initial data
    if (isInitialRender.current && currentPage === 1 && !debouncedNameQuery && selectedSpecialtySlugs.length === 0) {
      isInitialRender.current = false;
      return;
    }

    const fetchDoctors = async () => {
      if (!areaSlug || !districtSlug) return;
      setIsLoading(true);
      const apiParams = new URLSearchParams({
        locale,
        page: String(currentPage),
        perPage: String(perPage),
      });
      if (debouncedNameQuery) {
        apiParams.set("q", debouncedNameQuery);
      }
      if (selectedSpecialtySlugs.length > 0) {
        apiParams.set("specialty", selectedSpecialtySlugs.join(","));
      }

      try {
        const res = await fetch(`/api/area/doctors/${districtSlug}/${areaSlug}?${apiParams.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch doctors");
        const data = await res.json();
        setDoctors(data.rows || []);
        setTotal(data.total || 0);
      } catch (error) {
        console.error(error);
        setDoctors([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDoctors();
  }, [districtSlug, areaSlug, locale, currentPage, perPage, debouncedNameQuery, selectedSpecialtySlugs]);

  // Reset page when the name or specialty filters change (and only then).
  useResetPageOnFilterChange(
    `${debouncedNameQuery}|${selectedSpecialtySlugs.join(",")}`,
    resetPage
  );

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="mt-8">
      {/* Filters Section */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink-mute">{d.sec_specialties_title}</label>
          <SearchableMultiSelect
            options={specialtyOptions}
            value={selectedSpecialtySlugs.map(slug => slugToSpecialtyId.get(slug)!).filter(Boolean)}
            onChange={(ids) => {
              setSelectedSpecialtySlugs(ids.map(id => idToSpecialtySlug.get(id)!).filter((s): s is string => !!s));
            }}
            placeholder={d.filter_by_specialty || "Filter by specialty..."}
            emptyLabel={d.no_results || "No results"}
          />
        </div>
        <div>
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
          {/* Counts the whole filtered set, not just this page, so it reads the
              same on page 1 and page 3. Covers the specialty filter too. */}
          <SearchResultCount
            count={total}
            active={Boolean(debouncedNameQuery) || selectedSpecialtySlugs.length > 0}
            template={d.found_doctors}
            locale={locale}
          />
        </div>
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
