"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useUrlSearchParams } from "@/components/public/use-page-params";
import { num, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/admin/searchable-select";
import { useCallback } from "react";

// Public pagination is link-only on purpose. It used to accept an
// `onPageChange` callback, and every client-side listing passed one, which made
// the pager render <button> elements: the URL never changed, so page 2 could
// not be shared or bookmarked, the back button skipped the whole listing, and
// Googlebot (which does not click buttons) could never reach anything past
// page 1. Callers now drive the page from the URL via usePageParams().
type Props = {
  page: number;
  totalPages: number;
  perPage?: number;
  locale?: Locale;
  showPerPageSelector?: boolean;
};

const PER_PAGE_OPTIONS = [
  { id: 12, label: "12 / page" },
  { id: 24, label: "24 / page" },
  { id: 48, label: "48 / page" },
  { id: 96, label: "96 / page" },
];

export function Pagination({ page, totalPages, perPage, locale = "bn", showPerPageSelector = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useUrlSearchParams();

  // Every hook has to run before the early return below, or the hook count
  // changes between renders the moment totalPages drops to 1 (a filter that
  // narrows the list to a single page) and React throws "rendered fewer hooks
  // than expected".
  const makeHref = useCallback((p: number) => {
    const next = new URLSearchParams(params.toString());
    // Page 1 is the bare path, never ?page=1 — otherwise /areas and
    // /areas?page=1 are two URLs serving identical content, and Google has to
    // crawl both to work out they are the same page.
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, params]);

  // Nothing to render: one page of results and no per-page selector to offer.
  if (totalPages <= 1 && !showPerPageSelector) return null;

  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  // next/link, so this stays a client-side navigation: no full page reload, no
  // white flash, and `scroll={false}` keeps the viewport where it was, exactly
  // like the old buttons. The difference is that it is a real anchor, so
  // middle-click, ctrl+click, "open in new tab" and screen readers all work.
  const PageLink = ({ p, children, className }: { p: number, children: React.ReactNode, className: string }) => (
    <Link href={makeHref(p)} className={className} scroll={false} aria-current={p === page ? "page" : undefined}>
      {children}
    </Link>
  );

  const handlePerPageChange = (selectedId: number | null) => {
    if (!selectedId) return;
    const next = new URLSearchParams(params.toString());
    next.set("perPage", String(selectedId));
    // A bigger page size renumbers everything, so restart at page 1.
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="mt-[34px] flex flex-col items-center justify-center gap-4 sm:flex-row sm:justify-between">
      <div className="flex justify-center gap-2">
        {totalPages > 1 && (
          <>
            {page > 1 && (
              <PageLink p={page - 1} className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-line bg-white text-ink-faint">
                ‹
              </PageLink>
            )}
            {pages.map((p) => (
              <PageLink
                key={p}
                p={p}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-[10px] border text-sm",
                  p === page ? "border-brand-600 bg-brand-600 font-bold text-white" : "border-line bg-white text-ink-soft"
                )}
              >
                {num(p, locale)}
              </PageLink>
            ))}
            {page < totalPages && (
              <PageLink p={page + 1} className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-line bg-white text-brand-600">
                ›
              </PageLink>
            )}
          </>
        )}
      </div>

      {showPerPageSelector && (
        <div className="w-full max-w-[160px] sm:w-auto">
          <SearchableSelect
            options={PER_PAGE_OPTIONS}
            value={perPage || 12}
            onChange={handlePerPageChange}
            searchable={false}
            ariaLabel="Items per page"
          />
        </div>
      )}
    </div>
  );
}
