"use client";

import { useEffect, useRef, useState } from "react";
import { DoctorCard } from "@/components/public/doctor-card";
import { Pagination } from "@/components/public/pagination";
import { AnimatedGrid } from "@/components/animated-grid";
import { Shimmer } from "@/components/shimmer";
import { useUrlSearchParams } from "@/components/public/use-page-params";
import { useLocation } from "@/components/public/location-provider";
import { useShownDistrict } from "@/components/public/shown-district-context";
import { coordParam, roundCoord } from "@/lib/location";
import type { DoctorCardData } from "@/lib/data";
import type { Dict } from "@/lib/dict";
import type { Locale } from "@/lib/i18n";

// The result grid for /doctors.
//
// The page is static ISR and ships the canonical unfiltered first page inside
// the HTML, so crawlers and first paint both get real doctor cards. This
// component takes over from there: whenever the query string or the visitor's
// resolved location changes, it re-queries /api/doctors and swaps the grid.
//
// Two sources drive a refetch:
//   1. the URL — filters, sort and pagination, exactly as before;
//   2. LocationProvider — once the visitor's district is known, the ordering
//      becomes local-first, which is what the server used to do per request.
//
// The initial state is deliberately NOT refetched: `skipFirst` swallows the
// first effect run so a plain /doctors visit costs zero extra requests.

const FILTER_KEYS = [
  "q", "specialty", "area", "district", "hospital", "gender", "maxFee", "sort", "page", "perPage",
] as const;

export function DoctorListClient({
  initialDoctors,
  initialTotal,
  locale,
  d,
  helpline,
  helplineBn,
  defaultPerPage = 12,
  lockedDistrictSlug = null,
}: {
  initialDoctors: DoctorCardData[];
  initialTotal: number;
  locale: Locale;
  d: Dict;
  helpline: string;
  helplineBn: string | null;
  defaultPerPage?: number;
  /**
   * For a page that IS a district (/districts/<slug>/doctors). The slug lives
   * in the path, not the query, and <ListingFilters> hides its own district
   * selector when it is locked — so it has to be added to every request here.
   *
   * It also pins the curated order: someone on /districts/khulna/doctors is
   * asking about Khulna, whatever their own district is. Their coordinates
   * still rank the results within it.
   */
  lockedDistrictSlug?: string | null;
}) {
  const params = useUrlSearchParams();
  const { location, ready } = useLocation();
  const { set: setShownDistrict } = useShownDistrict();

  const [rows, setRows] = useState<DoctorCardData[]>(initialDoctors);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const skipFirst = useRef(true);

  // Everything that should trigger a requery, flattened to a comparable string
  // so the effect does not re-run on every render just because URLSearchParams
  // is a fresh object each time.
  const queryKey = FILTER_KEYS.map((k) => `${k}=${params.getAll(k).join("|")}`).join("&");
  // Rounded to the same precision the request below sends, so sub-kilometre
  // drift in an IP guess is not treated as a location change. See roundCoord.
  const geoLat = roundCoord(location.lat);
  const geoLng = roundCoord(location.lng);
  const geoKey = ready ? `${location.districtSlug ?? ""}:${geoLat ?? ""}:${geoLng ?? ""}` : "";

  const page = Math.max(1, Number(params.get("page")) || 1);
  const perPage = Math.max(1, Number(params.get("perPage")) || defaultPerPage);

  useEffect(() => {
    // The server already rendered exactly this state.
    if (skipFirst.current) {
      skipFirst.current = false;
      // ...unless the URL or the location already differ from the canonical
      // render, which is the deep-link case (/doctors?page=3) and the
      // returning-visitor case (district cookie present).
      const pristine = FILTER_KEYS.every((k) => params.getAll(k).length === 0);
      if (pristine && !geoKey.replace(/:/g, "")) return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      const qs = new URLSearchParams();
      qs.set("locale", locale);
      for (const k of FILTER_KEYS) {
        const values = params.getAll(k);
        if (values.length) qs.set(k, values.join(","));
      }
      // Always explicit. The URL only carries `perPage` once the visitor picks a
      // size from the selector, and without this the API fell back to its own
      // default (12) while the pager kept counting pages at `defaultPerPage` —
      // so the first filtered page rendered fewer cards than the pagination
      // promised. Same value the pager uses, URL-driven or default.
      qs.set("perPage", String(perPage));
      if (location.districtSlug) qs.set("preferDistrict", location.districtSlug);
      // Rounded: these two values are part of the CDN cache key for
      // /api/doctors and of the Data Cache key inside searchDoctors().
      const latParam = coordParam(location.lat);
      const lngParam = coordParam(location.lng);
      if (latParam !== null) qs.set("preferLat", latParam);
      if (lngParam !== null) qs.set("preferLng", lngParam);
      // Last, so it wins over anything the URL happened to carry.
      if (lockedDistrictSlug) {
        qs.set("district", lockedDistrictSlug);
        qs.set("priorityDistrict", lockedDistrictSlug);
      }

      try {
        const res = await fetch(`/api/doctors?${qs.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { rows: DoctorCardData[]; total: number };
        if (!cancelled) {
          setRows(data.rows);
          setTotal(data.total);
          // Tell the heading which district these cards are in. Nulls when the
          // result set is empty, so the heading falls back to the canonical
          // name rather than captioning nothing.
          setShownDistrict({
            name: data.rows[0]?.district ?? null,
            slug: data.rows[0]?.district_slug ?? null,
          });
        }
      } catch (err) {
        // An aborted request is the expected outcome when the visitor keeps
        // typing or clicks through pages quickly — never surface it. Any other
        // failure leaves the previous results on screen, which is a far better
        // outcome than blanking the page over a transient network error.
        if ((err as Error)?.name !== "AbortError" && !cancelled) {
          console.error("Doctor list refetch failed:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, geoKey, locale, setShownDistrict, lockedDistrictSlug]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <>
      {loading ? (
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[1100px]:grid-cols-3 min-[1400px]:grid-cols-4">
          {Array.from({ length: Math.min(perPage, 8) }).map((_, i) => (
            <Shimmer key={i} className="h-[260px] rounded-2xl" />
          ))}
        </div>
      ) : rows.length > 0 ? (
        <AnimatedGrid className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[1100px]:grid-cols-3 min-[1400px]:grid-cols-4">
          {rows.map((doc) => (
            <DoctorCard key={doc.id} doctor={doc} helpline={helpline} locale={locale} d={d} />
          ))}
        </AnimatedGrid>
      ) : (
        <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
          <div className="mb-2 font-heading text-lg font-bold text-ink">{d.no_doctors_found}</div>
          <p className="text-sm text-ink-faint">
            {d.no_doctors_found_sub} {locale === "bn" ? helplineBn : helpline}
          </p>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        locale={locale}
        perPage={perPage}
        showPerPageSelector
      />
    </>
  );
}
