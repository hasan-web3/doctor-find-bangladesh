"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { SearchableSelect, type Option } from "@/components/admin/searchable-select";
import { localeHref, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";
import { Shimmer } from "@/components/shimmer";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/icons";
import { useLocation } from "@/components/public/location-provider";

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
  photo_url: string | null;
};

function initials(name: string) {
  return name
    .replace(/^(ডাঃ|ডা\.|Dr\.?)\s*/i, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase();
}

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
  const { location } = useLocation();
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

  // `useState` reads its initial value once, so the two dropdowns would keep
  // whatever the IP guess produced on first mount even after the visitor
  // answers the district prompt — the server re-renders with new preselect
  // props but this component ignores them. Re-apply whenever the incoming
  // preselect actually changes, which only happens on a real location change.
  //
  // Tracked by value rather than with a plain effect so a visitor's own
  // dropdown choice is never reset by an unrelated re-render.
  // The visitor's own district outranks the server's preselect. The server
  // renders one cacheable document for everybody, so `preselectDistrictSlug` is
  // now the site-canonical district rather than theirs; LocationProvider
  // supplies the real one after hydration. Falling back to the prop keeps the
  // dropdown sensibly filled for a first-time visitor and for crawlers.
  const effectiveDistrictSlug = location.districtSlug ?? preselectDistrictSlug;
  const effectiveThanaSlug = location.districtSlug ? location.areaSlug : preselectThanaSlug;

  const appliedPreselect = useRef(`${preselectDistrictSlug ?? ""}|${preselectThanaSlug ?? ""}`);
  useEffect(() => {
    const key = `${effectiveDistrictSlug ?? ""}|${effectiveThanaSlug ?? ""}`;
    if (appliedPreselect.current === key) return;
    appliedPreselect.current = key;

    setDistrictId(effectiveDistrictSlug ? slugToDistrictId.get(effectiveDistrictSlug) ?? null : null);
    // Derived from the incoming values, not from `thanasForDistrict`, which is
    // still keyed to the previous district during this pass.
    const idx = effectiveDistrictSlug && effectiveThanaSlug
      ? thanas.filter((t) => t.district_slug === effectiveDistrictSlug).findIndex((t) => t.slug === effectiveThanaSlug)
      : -1;
    setThanaId(idx >= 0 ? idx + 1 : null);
  }, [effectiveDistrictSlug, effectiveThanaSlug, slugToDistrictId, thanas]);

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
      // Suggestions stay location-aware, but the district travels as an
      // explicit param instead of the endpoint re-deriving it from cookies on
      // every keystroke.
      if (location.districtSlug) params.set("preferDistrict", location.districtSlug);
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
  }, [debouncedQ, locale, location.districtSlug]);
  
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
                emptyLabel={locale === "bn" ? "কোনো শহর / গ্রাম নেই" : "No towns / villages"}
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

      {/* Suggestions Dropdown — on mobile it opens ABOVE the search bar so
          the on-screen keyboard doesn't cover the results; on ≥900px it
          drops down like a normal desktop autocomplete. */}
      {isSuggestionsOpen && (
        <div className="absolute bottom-full mb-2 w-full rounded-xl border border-line bg-white shadow-lg overflow-hidden z-50 min-[900px]:bottom-auto min-[900px]:top-full min-[900px]:mb-0 min-[900px]:mt-2">
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
                    className="flex items-center gap-3 px-4 py-2.5 text-left hover:bg-page transition-colors"
                    onClick={() => setIsSuggestionsOpen(false)}
                  >
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-page ring-1 ring-line">
                      {doc.photo_url ? (
                        <Image
                          src={doc.photo_url}
                          alt={doc.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-ink-mute">
                          {initials(doc.name)}
                        </span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold text-ink">{doc.name}</span>
                      <span className="truncate text-sm text-ink-mute">{doc.specialty}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-ink-mute">
              {debouncedQ.length > 1 && !isSuggestionsLoading ? (locale === "bn" ? "কোনো ডাক্তার পাওয়া যায়নি।" : "No doctors found.") : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
