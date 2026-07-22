"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { Icon } from "@/components/icons";
import { num, type Locale, localeHref } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Hospital } from "@/lib/data";
import type { Dict } from "@/lib/dict";
import { Pagination } from "@/components/public/pagination";
import { Shimmer } from "@/components/shimmer";

type Props = {
  pageTitle: string;
  locale: Locale;
  d: Dict;
  initialHospitals: Hospital[];
  initialTotal: number;
};

export function HospitalListClient({ pageTitle, locale, d, initialHospitals, initialTotal }: Props) {
  const [hospitals, setHospitals] = useState<Hospital[]>(initialHospitals);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(12);
  const isInitialRender = useRef(true);

  useEffect(() => {
    // Skip fetch on initial render
    if (isInitialRender.current && currentPage === 1) {
      isInitialRender.current = false;
      return;
    }

    const fetchHospitals = async () => {
      setIsLoading(true);
      const apiParams = new URLSearchParams({
        locale,
        page: String(currentPage),
        perPage: String(perPage),
      });

      try {
        const res = await fetch(`/api/hospitals?${apiParams.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch hospitals");
        const data = await res.json();
        setHospitals(data.rows || []);
        setTotal(data.total || 0);
      } catch (error) {
        console.error(error);
        setHospitals([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHospitals();
  }, [locale, currentPage, perPage]);

  const totalPages = Math.ceil(total / perPage);

  const handlePerPageChange = (newPerPage: number) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
  };
  
  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <Breadcrumbs locale={locale} items={[{ name: d.breadcrumb_home, path: "/" }, { name: d.nav_hospitals }]} />
      <h1 className="mb-1.5 font-heading text-[clamp(26px,4vw,34px)] font-bold text-ink">{pageTitle}</h1>
      <p className="mb-[26px] text-base text-ink-mute">{d.hospitals_sub}</p>

      {isLoading ? (
         <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: perPage }).map((_, i) => <Shimmer key={i} className="h-[360px] rounded-2xl" />)}
         </div>
      ) : (
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {hospitals.map((h) => (
            <div
              key={h.id}
              className="rounded-[18px] border border-line bg-white p-[22px] transition-all duration-200 hover:-translate-y-1 hover:shadow-cardhover"
            >
              <div className="relative mb-3.5 flex h-[150px] w-full items-center justify-center overflow-hidden rounded-[14px] bg-brand-50 text-brand-300">
                {h.image_url ? (
                  <Image src={h.image_url} alt={h.name} fill sizes="(max-width:640px) 100vw, 360px" className="object-cover" />
                ) : (
                  <Icon name="building" size={48} />
                )}
              </div>
              <Link href={localeHref(locale, `/hospitals/${h.slug}`)} className="mb-2 block font-heading text-[17px] font-semibold leading-normal text-ink hover:text-brand-700">
                {h.name}
              </Link>
              <div className="mb-3.5 flex items-center gap-1.5 text-sm text-ink-faint">
                <span className="text-brand-600">◉</span>
                {h.area || d.khulna}, {d.khulna}
              </div>
              <div className="mb-4 flex gap-4 border-t border-line pt-3.5 text-[13.5px] text-ink-mute">
                {h.departments.length > 0 && <span>{num(h.departments.length, locale)}{d.departments_count_suffix}</span>}
                {h.doctor_count > 0 && <span>{num(h.doctor_count, locale)}{d.doctors_count_suffix}</span>}
              </div>
              <div className="flex gap-2">
                <Link
                  href={localeHref(locale, `/hospitals/${h.slug}`)}
                  className="flex-1 rounded-[10px] border-[1.5px] border-brand-600 bg-white px-2.5 py-2.5 text-center text-sm font-semibold text-brand-700 hover:bg-brand-50"
                >
                  {d.view_details}
                </Link>
                {h.area_slug && h.district_slug && (
                  <Link
                    href={localeHref(locale, `/area/doctors/${h.district_slug}/${h.area_slug}`)}
                    className="flex items-center rounded-[10px] bg-brand-50 px-3.5 py-2.5 text-sm font-semibold text-brand-600"
                  >
                    {d.area_label}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          perPage={perPage}
          onPageChange={setCurrentPage}
          onPerPageChange={handlePerPageChange}
          showPerPageSelector={true}
          locale={locale}
        />
      )}
    </div>
  );
}
