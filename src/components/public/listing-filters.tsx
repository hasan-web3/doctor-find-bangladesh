"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { cn } from "@/lib/utils";
import { num, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";
import {
  SearchableSelect,
  SearchableMultiSelect,
  type Option,
} from "@/components/admin/searchable-select";

type Opt = { slug: string; name: string; name_en?: string | null };
type ThanaOpt = Opt & { district_slug: string | null };
type HospitalOpt = Opt & { district_slug?: string | null; area_slug?: string | null };

type FilterDict = Pick<Dict,
  "filters" | "clear_all" | "filter_specialty" | "filter_area" | "filter_gender" |
  "male" | "female" | "filter_fee" | "max" | "apply_filters" |
  "search_doctor_placeholder" | "sort_fee_asc" | "sort_fee_desc" | "sort_experience"> & {
  filter_hospital?: string;
  select_district?: string;
};

// SearchableSelect uses numeric ids. Build a slug↔id map for each list so we
// can round-trip URL slugs to the components and back.
function useSlugIndex<T extends { slug: string }>(items: T[]) {
  return useMemo(() => {
    const slugToId = new Map<string, number>();
    const idToSlug = new Map<number, string>();
    items.forEach((x, i) => {
      slugToId.set(x.slug, i + 1);
      idToSlug.set(i + 1, x.slug);
    });
    return { slugToId, idToSlug };
  }, [items]);
}

export function ListingFilters({
  specialties,
  districts,
  thanas,
  hospitals = [],
  locale,
  d,
  districtSlug, // Add districtSlug prop
}: {
  specialties: Opt[];
  districts: Opt[];
  thanas: ThanaOpt[];
  hospitals?: HospitalOpt[];
  locale: Locale;
  d: FilterDict;
  districtSlug?: string; // Add districtSlug type
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [maxFee, setMaxFee] = useState(params.get("maxFee") || "2000");
  const [parent] = useAutoAnimate();

  const setParams = useCallback(
    (patches: Array<[string, string | null]>, arrays?: Record<string, string[]>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of patches) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (arrays) {
        for (const [k, arr] of Object.entries(arrays)) {
          next.delete(k);
          arr.forEach((v) => next.append(k, v));
        }
      }
      next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, router, pathname]
  );

  // Current values from the URL
  const currentSpecs = params.getAll("specialty");
  const currentDistrict = params.get("district") || null;
  const currentThana = params.get("area") || null; // single now
  const currentHospital = params.get("hospital") || null;
  const currentGender = params.get("gender");

  // If a districtSlug is passed directly (e.g. on district page), use it.
  // Otherwise fall back to the district from search params.
  const effectiveDistrict = districtSlug || currentDistrict;

  // Index maps
  const specIdx = useSlugIndex(specialties);
  const distIdx = useSlugIndex(districts);

  // Only thanas within the chosen district (empty when none picked)
  const thanasInDistrict = useMemo(
    () => (effectiveDistrict ? thanas.filter((t) => t.district_slug === effectiveDistrict) : []),
    [thanas, effectiveDistrict]
  );
  const thanaIdx = useSlugIndex(thanasInDistrict);

  // Hospitals shrink to selected district/thana when set; otherwise show all.
  const hospitalsFiltered = useMemo(() => {
    let out = hospitals;
    if (effectiveDistrict) out = out.filter((h) => !h.district_slug || h.district_slug === effectiveDistrict);
    if (currentThana) out = out.filter((h) => !h.area_slug || h.area_slug === currentThana);
    return out;
  }, [hospitals, effectiveDistrict, currentThana]);
  const hospitalIdx = useSlugIndex(hospitalsFiltered);

  const specOptions: Option[] = specialties.map((s, i) => ({ id: i + 1, label: s.name, label_en: s.name_en ?? null }));
  const distOptions: Option[] = districts.map((x, i) => ({ id: i + 1, label: x.name, label_en: x.name_en ?? null }));
  const thanaOptions: Option[] = thanasInDistrict.map((t, i) => ({ id: i + 1, label: t.name, label_en: t.name_en ?? null }));
  const hospitalOptions: Option[] = hospitalsFiltered.map((h, i) => ({ id: i + 1, label: h.name, label_en: h.name_en ?? null }));

  const body = (
    <div ref={parent} className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-heading text-[17px] font-bold text-ink">{d.filters}</div>
        <button onClick={() => router.push(pathname)} className="text-[12.5px] font-semibold text-brand-600">
          {d.clear_all}
        </button>
      </div>

      {/* Specialty — searchable multi-select */}
      <div className="mb-[9px] text-sm font-semibold text-ink-soft">{d.filter_specialty}</div>
      <div className="mb-[18px]">
        <SearchableMultiSelect
          options={specOptions}
          value={currentSpecs.map((s) => specIdx.slugToId.get(s)).filter((n): n is number => !!n)}
          onChange={(ids) => setParams([], { specialty: ids.map((id) => specIdx.idToSlug.get(id)!).filter(Boolean) })}
          placeholder={locale === "bn" ? "বিভাগ নির্বাচন করুন" : "Pick specialties"}
          emptyLabel={locale === "bn" ? "কোনো বিভাগ নেই" : "No specialties"}
        />
      </div>

      {/* District → cascades to Thana. Hide if we have a locked districtSlug */}
      {!districtSlug && (
        <>
          <div className="mb-[9px] text-sm font-semibold text-ink-soft">
            {locale === "bn" ? "জেলা" : "District"}
          </div>
          <div className="mb-3">
            <SearchableSelect
              options={distOptions}
              value={currentDistrict ? distIdx.slugToId.get(currentDistrict) ?? null : null}
              onChange={(id) => {
                const slug = id ? distIdx.idToSlug.get(id) ?? null : null;
                setParams([["district", slug], ["area", null]]);
              }}
              placeholder={d.select_district ?? (locale === "bn" ? "জেলা নির্বাচন করুন" : "Select district")}
              emptyLabel={locale === "bn" ? "কোনো জেলা নেই" : "No districts"}
            />
          </div>
        </>
      )}

      {/* Thana — only shown once a district is picked/locked */}
      {effectiveDistrict && (
        <>
          <div className="mb-[9px] text-sm font-semibold text-ink-soft">{d.filter_area}</div>
          <div className="mb-[18px] animate-fadein">
            <SearchableSelect
              options={thanaOptions}
              value={currentThana ? thanaIdx.slugToId.get(currentThana) ?? null : null}
              onChange={(id) => setParams([["area", id ? thanaIdx.idToSlug.get(id) ?? null : null]])}
              placeholder={d.filter_area}
              emptyLabel={locale === "bn" ? "কোনো থানা নেই" : "No thanas"}
            />
          </div>
        </>
      )}

      {/* Hospital — searchable, scoped to picked district/thana when set */}
      {hospitalOptions.length > 0 && (
        <>
          <div className="mb-[9px] text-sm font-semibold text-ink-soft">
            {d.filter_hospital ?? (locale === "bn" ? "হাসপাতাল" : "Hospital")}
          </div>
          <div className="mb-[18px]">
            <SearchableSelect
              options={hospitalOptions}
              value={currentHospital ? hospitalIdx.slugToId.get(currentHospital) ?? null : null}
              onChange={(id) => setParams([["hospital", id ? hospitalIdx.idToSlug.get(id) ?? null : null]])}
              placeholder={locale === "bn" ? "হাসপাতাল নির্বাচন করুন" : "Pick a hospital"}
              emptyLabel={locale === "bn" ? "কোনো হাসপাতাল নেই" : "No hospitals"}
            />
          </div>
        </>
      )}

      <div className="mb-[9px] text-sm font-semibold text-ink-soft">{d.filter_gender}</div>
      <div className="mb-[18px] flex gap-1.5">
        {[["male", d.male], ["female", d.female]].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setParams([["gender", currentGender === value ? null : value]])}
            className={cn(
              "flex-1 rounded-lg border px-2 py-2 text-[13px]",
              currentGender === value ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-line bg-white text-ink-mute"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-[9px] text-sm font-semibold text-ink-soft">{d.filter_fee}</div>
      <input
        type="range"
        min={200}
        max={2000}
        step={50}
        value={maxFee}
        onChange={(e) => setMaxFee(e.target.value)}
        onMouseUp={() => setParams([["maxFee", maxFee === "2000" ? null : maxFee]])}
        onTouchEnd={() => setParams([["maxFee", maxFee === "2000" ? null : maxFee]])}
        className="mb-1.5 w-full accent-brand-600"
      />
      <div className="mb-[18px] flex justify-between text-[12.5px] text-ink-ghost">
        <span>{num(200, locale)}</span>
        <span className="font-semibold text-brand-700">{d.max} {num(Number(maxFee), locale)}</span>
        <span>{num(2000, locale)}</span>
      </div>

    </div>
  );

  return (
    <>
      {/* desktop sidebar */}
      <div className="hidden min-[900px]:block">
        <div className="sticky top-[88px]">{body}</div>
      </div>

      {/* mobile filter button + drawer */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-[7px] rounded-xl border border-line bg-white px-4 py-[11px] text-sm text-ink-soft min-[900px]:hidden"
      >
        {d.filters}
      </button>
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-[70] bg-ink/45 transition-opacity min-[900px]:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[71] max-h-[85vh] overflow-y-auto rounded-t-3xl bg-page p-4 transition-transform duration-300 min-[900px]:hidden",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" />
        {body}
        <button onClick={() => setOpen(false)} className="mt-3 w-full rounded-[10px] bg-brand-600 py-[11px] font-semibold text-white">
          {d.apply_filters}
        </button>
      </div>
    </>
  );
}

export function SortSelect({ d }: { d: FilterDict & { sort_relevance: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const options = [
    { id: 0, slug: null, label: d.sort_relevance },
    { id: 1, slug: 'fee_asc', label: d.sort_fee_asc },
    { id: 2, slug: 'fee_desc', label: d.sort_fee_desc },
    { id: 3, slug: 'experience', label: d.sort_experience },
  ];

  const currentSelection = params.get("sort");
  const selectedId = options.find(opt => opt.slug === currentSelection)?.id ?? 0;

  return (
    <div className="w-full sm:w-[200px]">
      <SearchableSelect
        options={options}
        value={selectedId}
        onChange={(id) => {
          const selection = options.find(opt => opt.id === id);
          const next = new URLSearchParams(params.toString());
          if (selection?.slug) {
            next.set("sort", selection.slug);
          } else {
            next.delete("sort");
          }
          next.delete("page");
          router.push(`${pathname}?${next.toString()}`);
        }}
        placeholder="..."
        emptyLabel=""
        searchable={false}
      />
    </div>
  );
}

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

export function ListingSearch({ d }: { d: FilterDict }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const debouncedQ = useDebounce(q, 400);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // Do not run on mount if the debounced query is the same as the URL param
      if (debouncedQ === (params.get("q") || "")) {
        return;
      }
    }

    // Only trigger navigation if the query has actually changed
    if (debouncedQ === (params.get("q") || "")) {
      return;
    }

    const next = new URLSearchParams(params.toString());
    if (debouncedQ.trim()) {
      next.set("q", debouncedQ.trim());
    } else {
      next.delete("q");
    }
    next.delete("page");
    // Using requestAnimationFrame to ensure the state update doesn't block painting
    requestAnimationFrame(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }, [debouncedQ, router, pathname, params]);

  return (
    <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3.5">
      <span className="text-ink-ghost">⌕</span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={d.search_doctor_placeholder}
        className="flex-1 border-none bg-transparent py-3 text-[14.5px] outline-none placeholder:text-ink-ghost"
      />
    </div>
  );
}
