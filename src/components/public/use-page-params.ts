"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

// Pagination state lives in the URL, never in React state.
//
// Every public listing server-renders exactly the slice named by ?page=, so
// keeping the client's idea of "current page" anywhere else immediately drifts:
// /areas?page=2 used to render page 2's cards while the pager highlighted 1.
// Reading it back from the URL keeps the two halves in lockstep, makes page 2
// shareable and bookmarkable, restores the browser back button, and lets the
// pager render real <a href> links that a crawler can follow.
export function usePageParams(defaultPerPage: number) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const page = Math.max(1, Number(params.get("page")) || 1);
  const perPage = Math.max(1, Number(params.get("perPage")) || defaultPerPage);

  // Filters narrow the result set, so whatever page the visitor was on no
  // longer exists. Drop the param (replace, not push, so the back button does
  // not walk through every keystroke) and let the listing fall back to page 1.
  const resetPage = useCallback(() => {
    if (!params.get("page")) return;
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return { page, perPage, resetPage };
}

// Drop ?page= when the FILTERS change, and only then.
//
// This has to compare the filter value itself, not lean on the effect's
// dependency array. `resetPage` closes over the current searchParams, so its
// identity changes on every navigation — including the navigation to page 2.
// An effect that simply listed `resetPage` as a dependency therefore fired
// again the instant the visitor reached page 2 and stripped the page number
// back off, which is why pagination flashed page 2 and snapped back to page 1.
//
// `filterKey` must be a stable serialisation of every filter that should send
// the visitor back to the first page (search text, selected specialties, ...).
export function useResetPageOnFilterChange(filterKey: string, resetPage: () => void) {
  const previous = useRef<string | null>(null);

  useEffect(() => {
    // First run just records the starting filters; it must not reset, or a
    // direct visit to /areas?page=3 would bounce to page 1 on mount.
    if (previous.current === null) {
      previous.current = filterKey;
      return;
    }
    if (previous.current === filterKey) return;
    previous.current = filterKey;
    resetPage();
  }, [filterKey, resetPage]);
}
