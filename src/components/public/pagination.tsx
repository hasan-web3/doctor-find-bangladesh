"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { num, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/admin/searchable-select";
import { useCallback } from "react";

type Props = {
  page: number;
  totalPages: number;
  perPage?: number;
  locale?: Locale;
  onPageChange?: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  showPerPageSelector?: boolean;
};

const PER_PAGE_OPTIONS = [
  { id: 12, label: "12 / page" },
  { id: 24, label: "24 / page" },
  { id: 48, label: "48 / page" },
  { id: 96, label: "96 / page" },
];

export function Pagination({ page, totalPages, perPage, locale = "bn", onPageChange, onPerPageChange, showPerPageSelector = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // This component can't render if it's not needed
  if (totalPages <= 1 && (!showPerPageSelector || (perPage || 12) >= totalPages * (perPage || 12))) {
    if (totalPages <= 1 && !showPerPageSelector) return null;
  }

  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);
  
  const makeHref = useCallback((p: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    return `${pathname}?${next.toString()}`;
  }, [pathname, params]);

  const PageLink = ({ p, children, className }: { p: number, children: React.ReactNode, className: string }) => {
    if (onPageChange) {
      return (
        <button type="button" onClick={() => onPageChange(p)} className={className}>
          {children}
        </button>
      );
    }
    return (
      <Link href={makeHref(p)} className={className} scroll={false}>
        {children}
      </Link>
    );
  };

  const handlePerPageChange = (selectedId: number | null) => {
    if (!selectedId) return;
    if (onPerPageChange) {
      onPerPageChange(selectedId);
    } else {
      const next = new URLSearchParams(params.toString());
      next.set("perPage", String(selectedId));
      next.set("page", "1");
      router.push(`${pathname}?${next.toString()}`);
    }
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
