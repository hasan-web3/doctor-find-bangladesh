"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { SearchableSelect, type Option } from "@/components/admin/searchable-select";
import { localeHref, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";
import { Shimmer } from "@/components/shimmer";
import Link from "next/link";
import { Icon } from "@/components/icons";

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

type ThanaOpt = { slug: string; name: string; name_en?: string | null; district_slug: string | null };
type DistrictOpt = { slug: string; name: string; name_en?: string | null };
type Suggestion = {
  name: string;
  slug: string;
  specialty: string;
};

export function SearchBar({
  districts,
  thanas,
  locale,
  d,
  preselectDistrictSlug = null,
  preselectThanaSlug = null,
}: {
  districts: DistrictOpt[];
  thanas: ThanaOpt[];
  locale: Locale;
  d: Pick<Dict, "search_placeholder" | "select_area" | "search"> & {
    select_district?: string;
  };
  preselectDistrictSlug?: string | null;
  preselectThanaSlug?: string | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [parent] = useAutoAnimate();
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // --- Live Search Suggestions State ---
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const debouncedQ = useDebounce(q, 300);

  // --- Existing Location Dropdown Logic ---
  const districtOptions: Option[] = useMemo(() => districts.map((x, i) => ({ id: i + 1, label: x.name, label_en: x.name_en ?? null })), [districts]);
  const slugToDistrictId = useMemo(() => new Map(districts.map((x, i) => [x.slug, i + 1])), [districts]);
  const districtIdToSlug = useMemo(() => new Map(districts.map((x, i) => [i + 1, x.slug])), [districts]);
  const [districtId, setDistrictId] = useState<number | null>(preselectDistrictSlug ? slugToDistrictId.get(preselectDistrictSlug) ?? null : null);
  const districtSlug = districtId ? districtIdToSlug.get(districtId) ?? null : null;
  const thanasForDistrict = useMemo(() => (districtSlug ? thanas.filter((t) => t.district_slug === districtSlug) : []), [thanas, districtSlug]);
  const thanaOptions: Option[] = useMemo(() => thanasForDistrict.map((t, i) => ({ id: i + 1, label: t.name, label_en: t.name_en ?? null })), [thanasForDistrict]);
  const slugToThanaId = useMemo(() => new Map(thanasForDistrict.map((t, i) => [t.slug, i + 1])), [thanasForDistrict]);
  const thanaIdToSlug = useMemo(() => new Map(thanasForDistrict.map((t, i) => [i + 1, t.slug])), [thanasForDistrict]);
  const [thanaId, setThanaId] = useState<number | null>(preselectThanaSlug && preselectDistrictSlug ? slugToThanaId.get(preselectThanaSlug) ?? null : null);

  // --- Fetch suggestions when debounced query changes ---
  useEffect(() => {
    if (debouncedQ.length < 2) {
      setSuggestions([]);
      setIsSuggestionsOpen(false);
      return;
    }

    const fetchSuggestions = async () => {
      setIsSuggestionsLoading(true);
      setIsSuggestionsOpen(true);
      const params = new URLSearchParams({ q: debouncedQ, locale });
      try {
        const res = await fetch(`/api/search/suggestions?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setSuggestions(data || []);
      } catch (error) {
        console.error(error);
        setSuggestions([]);
      } finally {
        setIsSuggestionsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQ, locale]);
  
  // --- Close suggestions when clicking outside ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
        setIsSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const go = () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (districtSlug) params.set("district", districtSlug);
    const thanaSlug = thanaId ? thanaIdToSlug.get(thanaId) : null;
    if (thanaSlug) params.set("area", thanaSlug);
    router.push(`${localeHref(locale, "/doctors")}${params.size ? `?${params}` : ""}`);
  };

  return (
    <div ref={searchWrapperRef} className="relative z-30">
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-2.5 shadow-pop min-[900px]:flex-row min-[900px]:items-center">
        {/* free-text doctor / specialty search */}
        <div className="flex flex-1 items-center gap-2 px-3 order-3 min-[900px]:order-none">
          <span className="text-lg text-ink-ghost">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setIsSuggestionsOpen(q.length > 1)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder={d.search_placeholder}
            className="flex-1 border-none bg-transparent py-3 text-[15px] text-ink outline-none placeholder:text-ink-ghost"
            autoComplete="off"
          />
        </div>

        <div className="h-px bg-line order-2 min-[900px]:hidden" />

        {/* cascade: district → thana */}
        <div ref={parent} className="flex flex-col gap-2 px-1 sm:flex-row sm:gap-2 sm:px-2 min-[900px]:min-w-[220px] order-1 min-[900px]:order-none">
          <div className="min-w-[180px] flex-1">
            <SearchableSelect
              options={districtOptions}
              value={districtId}
              onChange={(id) => { setDistrictId(id); setThanaId(null); }}
              placeholder={d.select_district ?? (locale === "bn" ? "জেলা নির্বাচন করুন" : "Select district")}
              emptyLabel={locale === "bn" ? "কোনো জেলা নেই" : "No districts"}
            />
          </div>
          {districtSlug && (
            <div className="min-w-[180px] flex-1 animate-fadein">
              <SearchableSelect
                options={thanaOptions}
                value={thanaId}
                onChange={setThanaId}
                placeholder={d.select_area}
                emptyLabel={locale === "bn" ? "কোনো থানা নেই" : "No thanas"}
              />
            </div>
          )}
        </div>

        <button
          onClick={go}
          className="whitespace-nowrap rounded-xl bg-brand-600 px-[26px] py-3.5 text-[15.5px] font-bold text-white transition-colors hover:bg-brand-700 order-4 min-[900px]:order-none"
        >
          {d.search}
        </button>
      </div>

      {/* Suggestions Dropdown */}
      {isSuggestionsOpen && (
        <div className="absolute top-full mt-2 w-full rounded-xl border border-line bg-white shadow-lg overflow-hidden z-50">
          {isSuggestionsLoading ? (
            <div className="p-4 space-y-3">
              <Shimmer className="h-6 w-3/4" />
              <Shimmer className="h-6 w-1/2" />
              <Shimmer className="h-6 w-2/3" />
            </div>
          ) : suggestions.length > 0 ? (
            <ul className="py-2">
              {suggestions.map((doc) => (
                <li key={doc.slug}>
                  <Link 
                    href={localeHref(locale, `/doctors/${doc.slug}`)}
                    className="flex flex-col px-4 py-2.5 text-left hover:bg-page transition-colors"
                    onClick={() => setIsSuggestionsOpen(false)}
                  >
                    <span className="font-semibold text-ink">{doc.name}</span>
                    <span className="text-sm text-ink-mute">{doc.specialty}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-ink-mute">
              {debouncedQ.length > 1 && !isSuggestionsLoading ? "No doctors found." : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
