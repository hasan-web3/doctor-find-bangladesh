"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { localeHref, type Locale } from "@/lib/i18n";
import { useUrlSearchParams } from "@/components/public/use-page-params";

// The category filter row for /blog.
//
// Split out of the page because deciding which chip is "active" needs
// ?category=, and reading that on the server would force the whole blog index
// to render per request. The chips are real <a href> links either way, so a
// crawler still follows every category; only the highlight is client-side.

export function BlogCategoryChips({
  categories,
  locale,
  allLabel,
}: {
  categories: { id: number | string; slug: string; name: string }[];
  locale: Locale;
  allLabel: string;
}) {
  const params = useUrlSearchParams();
  const active = params.get("category");
  const L = (path: string) => localeHref(locale, path);

  if (categories.length === 0) return null;

  return (
    <div className="mb-[26px] flex flex-wrap gap-2">
      <Link
        href={L("/blog")}
        className={cn(
          "rounded-full border px-4 py-2 text-sm font-semibold",
          !active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink-soft"
        )}
      >
        {allLabel}
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`${L("/blog")}?category=${c.slug}`}
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-semibold",
            active === c.slug ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink-soft"
          )}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
