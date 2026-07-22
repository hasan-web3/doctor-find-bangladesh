"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { SearchableFilter, type FilterOption } from "@/components/public/searchable-filter";
import { DoctorCard } from "@/components/public/doctor-card";
import { Pagination } from "@/components/public/pagination";
import type { DoctorCardData } from "@/lib/data";
import type { Dict } from "@/lib/dict";
import { num, type Locale } from "@/lib/i18n";
import { Reveal } from "@/components/reveal";
import { Icon } from "@/components/icons";
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

type EnrichedDoctor = DoctorCardData & { all_specialties: string[] };

type Props = {
  departments: { name: string; slug: string }[];
  settings: { helpline: string; helpline_bn: string | null };
  locale: Locale;
  d: Dict;
  initialDoctors: EnrichedDoctor[];
  initialTotal: number;
};

export function HospitalDoctorList({ departments, settings, locale, d, initialDoctors, initialTotal }: Props) {
  const params = useParams();
  const hospitalSlug = typeof params.slug === 'string' ? params.slug : '';
  const [parent] = useAutoAnimate();

  // State
  const [doctors, setDoctors] = useState(initialDoctors);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDeptSlugs, setSelectedDeptSlugs] = useState<string[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(12);
  const isInitialRender = useRef(true);

  const debouncedNameQuery = useDebounce(nameQuery, 300);
  
  const departmentOptions: FilterOption[] = useMemo(() => 
    departments.map((dep) => ({ id: dep.slug, label: dep.name })),
    [departments]
  );
  
  const selectedDepartments = useMemo(() => {
    return departmentOptions.filter((opt) => selectedDeptSlugs.includes(opt.id as string));
  }, [selectedDeptSlugs, departmentOptions]);

  useEffect(() => {
    // Skip fetch on initial render if no filters are applied
    if (isInitialRender.current && currentPage === 1 && !debouncedNameQuery && selectedDeptSlugs.length === 0) {
      isInitialRender.current = false;
      return;
    }

    const fetchDoctors = async () => {
      if (!hospitalSlug) return;
      setIsLoading(true);
      const apiParams = new URLSearchParams({
        locale,
        page: String(currentPage),
        perPage: String(perPage),
      });
      if (debouncedNameQuery) apiParams.set("q", debouncedNameQuery);
      if (selectedDeptSlugs.length > 0) apiParams.set("specialty", selectedDeptSlugs.join(','));

      try {
        const res = await fetch(`/api/hospitals/${hospitalSlug}/doctors?${apiParams.toString()}`);
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
  }, [hospitalSlug, locale, currentPage, perPage, debouncedNameQuery, selectedDeptSlugs]);
  
  // Reset page when filters change
  useEffect(() => {
    if (!isInitialRender.current) {
      setCurrentPage(1);
    }
  }, [debouncedNameQuery, selectedDeptSlugs]);

  const totalPages = Math.ceil(total / perPage);

  const handlePerPageChange = (newPerPage: number) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
  };
  
  const handleRemoveDept = (slug: string) => {
    setSelectedDeptSlugs((prev) => prev.filter((s) => s !== slug));
  };
  
  return (
    <>
      <div className="mb-8">
        <h2 className="mb-3.5 mt-0 font-heading text-xl font-bold text-ink">{d.hospital_doctors}</h2>
        
        {/* Active Filters */}
        {selectedDepartments.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {selectedDepartments.map((dept) => (
              <div
                key={dept.id}
                className="flex items-center gap-2 rounded-full bg-brand-50 py-1 pl-3 pr-2 text-sm font-medium text-brand-700"
              >
                <span>{dept.label}</span>
                <button onClick={() => handleRemoveDept(dept.id as string)} className="rounded-full p-0.5 hover:bg-brand-100">
                   <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Filters */}
        <div className="flex flex-col md:grid md:grid-cols-2 gap-4 mb-6">
          <div className="order-2 md:order-1">
            <label className="mb-1.5 block text-sm font-semibold text-ink-mute">{d.filter_by_name}</label>
             <div className="relative">
              <input
                type="text"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                placeholder={d.search_doctor_placeholder || "Enter doctor's name..."}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none text-base"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
                <Icon name="search" size={18} />
              </div>
            </div>
          </div>
          {departments.length > 0 && (
            <div className="order-1 md:order-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink-mute">{d.filter_by_department}</label>
              <SearchableFilter
                options={departmentOptions}
                value={selectedDeptSlugs}
                onChange={(slugs) => {
                  setSelectedDeptSlugs(slugs as string[]);
                }}
                placeholder={d.filter_by_department || "Filter by department..."}
                emptyLabel={d.no_results || "No results"}
              />
            </div>
          )}
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
                onPageChange={setCurrentPage}
                onPerPageChange={handlePerPageChange}
                showPerPageSelector={true}
                locale={locale}
            />
        </div>
      )}
    </>
  );
}
