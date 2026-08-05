"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// useUrlSearchParams — a drop-in for next/navigation's useSearchParams() that
// does NOT opt the page out of static rendering.
// ---------------------------------------------------------------------------
// Next bails a page out of prerendering the moment a client component calls
// useSearchParams(), because the query string is not known at build time. The
// documented escape hatch is a <Suspense> boundary — but that puts the
// FALLBACK into the static HTML, which for our listings would mean shipping
// pages with no doctor cards in them and asking Google to run JS to see the
// content. Unacceptable on a directory whose entire value is those listings.
//
// So we read the query string ourselves instead:
//   - on the server and on the very first client render it is "" — exactly the
//     state the prerendered HTML represents (page 1, no filters);
//   - after mount it reflects the real URL and stays reactive.
//
// Reactivity needs both halves: `popstate` covers back/forward, and Next's
// router.push/replace ultimately call history.pushState/replaceState, which
// fire no event of their own — so we patch them once to emit one. Without the
// patch, clicking to page 2 would change the URL and nothing would re-render.
//
// The dispatch MUST be deferred to a microtask. Next's App Router calls
// pushState from inside a useInsertionEffect; dispatching synchronously there
// notifies useSyncExternalStore subscribers mid-insertion-phase, which React
// rejects ("useInsertionEffect must not schedule updates") and drops on the
// floor — the URL changed but the list did not re-render until some unrelated
// event happened to schedule the next render, seconds later. A microtask lands
// after the insertion phase, so the update is a normal one.

const NAV_EVENT = "app:urlchange";
let historyPatched = false;

function patchHistoryOnce() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method];
    window.history[method] = function patched(
      this: History,
      ...args: Parameters<History[typeof method]>
    ) {
      const result = original.apply(this, args);
      queueMicrotask(() => window.dispatchEvent(new Event(NAV_EVENT)));
      return result;
    };
  }
}

function subscribe(onChange: () => void): () => void {
  patchHistoryOnce();
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAV_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAV_EVENT, onChange);
  };
}

const getSnapshot = () => window.location.search;
// Must be a stable value, not a new object: useSyncExternalStore compares
// snapshots by identity and would loop forever on a fresh one each call.
const getServerSnapshot = () => "";

/** The current query string ("?a=1"), reactive, prerender-safe. */
export function useUrlSearchParams(): URLSearchParams {
  const search = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return new URLSearchParams(search);
}

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
  const params = useUrlSearchParams();

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
