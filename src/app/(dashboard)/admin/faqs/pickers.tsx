import Link from "next/link";
import { FAQ_SCOPES, type FaqScope } from "./scopes";

// ---------------------------------------------------------------------------
// LEVEL 1 — pick a scope.
//
// Backed by ONE aggregate query (`GROUP BY scope` over faqs), so the landing
// view costs a single scan and loads no entity lists at all. The page used to
// open by fetching every FAQ plus every specialty, area, hospital and 500
// doctors before rendering a line.
// ---------------------------------------------------------------------------
export function ScopeGrid({
  counts,
  disabledScopes,
}: {
  /** `pages` = how many pages carry an FAQ block; `stored` = hand-edited rows. */
  counts: Record<string, { pages: number; stored: number }>;
  disabledScopes: Set<string>;
}) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {FAQ_SCOPES.map((s) => {
        const c = counts[s.value] ?? { pages: 0, stored: 0 };
        const off = disabledScopes.has(s.value);
        return (
          <Link
            key={s.value}
            href={`/admin/faqs?scope=${s.value}`}
            className={`group flex items-center justify-between gap-3 rounded-[14px] border p-5 transition-colors hover:border-brand-400 hover:bg-brand-50/40 ${
              off ? "border-amber-200 bg-amber-50/50" : "border-line bg-white"
            }`}
          >
            <div className="min-w-0">
              <div className="font-heading text-[16px] font-bold text-ink">{s.label}</div>
              <div className="mt-0.5 text-[13px] text-ink-faint">
                {off ? (
                  <span className="font-semibold text-amber-700">FAQ বন্ধ আছে</span>
                ) : c.pages > 0 ? (
                  <>
                    {c.pages} টি পেজে FAQ আছে
                    {c.stored > 0 ? ` · ${c.stored} টি সম্পাদিত` : " · সব স্বয়ংক্রিয়"}
                  </>
                ) : (
                  "এখনো কোনো পেজে FAQ নেই"
                )}
              </div>
            </div>
            <span
              aria-hidden
              className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-[15px] font-bold text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white"
            >
              {c.pages}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export type EntityRow = {
  id: number;
  name_bn: string | null;
  context: string | null;
  faq_count: number;
};

// ---------------------------------------------------------------------------
// LEVEL 2 — pick the entity within a scope.
//
// Two mutually exclusive queries feed this, never both:
//
//   no search  -> only the entities that ALREADY have FAQs (a JOIN off `faqs`,
//                 so the result is bounded by how many FAQs exist, not by how
//                 many doctors or thanas the site has).
//   searching  -> the scope's own table, LIMIT 24.
//
// That is the whole point: with 600+ thanas and thousands of doctors, listing
// every candidate up front is exactly the query we must never run. You reach an
// entity with no FAQs yet by searching for it.
// ---------------------------------------------------------------------------
export function EntityGrid({
  scope,
  rows,
  searching,
}: {
  scope: FaqScope;
  rows: EntityRow[];
  searching: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-line bg-white p-8 text-center text-sm text-ink-faint">
        {searching
          ? "এই নামে কিছু পাওয়া যায়নি। বানান দেখে আবার চেষ্টা করুন।"
          : "এই স্কোপে এখনো কোনো FAQ যোগ করা হয়নি। উপরে খুঁজে নির্দিষ্টটি বেছে নিন, তারপর FAQ যোগ করুন।"}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((e) => (
        <Link
          key={e.id}
          href={`/admin/faqs?scope=${scope}&ref=${e.id}`}
          className="group flex items-center justify-between gap-3 rounded-[14px] border border-line bg-white p-4 transition-colors hover:border-brand-400 hover:bg-brand-50/40"
        >
          <div className="min-w-0">
            <div className="truncate text-[14.5px] font-semibold text-ink">{e.name_bn || `#${e.id}`}</div>
            {e.context && <div className="mt-0.5 truncate text-[12.5px] text-ink-faint">{e.context}</div>}
          </div>
          <span
            aria-hidden
            className={`shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-bold transition-colors ${
              e.faq_count > 0
                ? "bg-brand-50 text-brand-700 group-hover:bg-brand-600 group-hover:text-white"
                : "bg-slate-100 text-ink-faint"
            }`}
          >
            {e.faq_count}
          </span>
        </Link>
      ))}
    </div>
  );
}

// Prev / next for the entity list. Server-rendered links rather than client
// state, so the page stays shareable and the browser Back button works.
export function FaqPagination({
  scope,
  q,
  page,
  totalPages,
}: {
  scope: FaqScope;
  q: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams({ scope });
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    return `/admin/faqs?${sp.toString()}`;
  };

  const btn = "rounded-[10px] border border-line bg-white px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50";
  const off = "rounded-[10px] border border-line bg-page px-4 py-2 text-sm font-semibold text-ink-ghost cursor-not-allowed";

  return (
    <div className="mt-6 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className={btn} rel="prev">← আগের</Link>
      ) : (
        <span className={off} aria-disabled>← আগের</span>
      )}
      <span className="text-[13.5px] text-ink-faint">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className={btn} rel="next">পরের →</Link>
      ) : (
        <span className={off} aria-disabled>পরের →</span>
      )}
    </div>
  );
}

// Breadcrumb + back link for levels 2 and 3.
export function FaqCrumbs({
  scope,
  scopeLabel,
  entityName,
}: {
  scope: FaqScope;
  scopeLabel: string;
  entityName?: string | null;
}) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[13.5px] text-ink-faint">
      <Link href="/admin/faqs" className="font-semibold text-brand-600 hover:underline">
        FAQ
      </Link>
      <span aria-hidden>/</span>
      {entityName ? (
        <>
          <Link href={`/admin/faqs?scope=${scope}`} className="font-semibold text-brand-600 hover:underline">
            {scopeLabel}
          </Link>
          <span aria-hidden>/</span>
          <span className="font-semibold text-ink">{entityName}</span>
        </>
      ) : (
        <span className="font-semibold text-ink">{scopeLabel}</span>
      )}
    </nav>
  );
}
