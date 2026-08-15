'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatedGrid } from '@/components/animated-grid';
import { Shimmer } from '@/components/shimmer';
import { Pagination } from '@/components/public/pagination';
import { usePageParams, useUrlSearchParams } from '@/components/public/use-page-params';
import { type Locale, localeHref, date as fmtDate } from '@/lib/i18n';
import { type BlogPostCard } from '@/lib/data';
import { type getDict } from '@/lib/dict';

type Dict = ReturnType<typeof getDict>;

// The page size the server prerenders with. Exported so page.tsx and this
// component cannot drift — if they disagree, the first client fetch would
// silently re-request a different slice than the HTML already shows.
export const BLOG_PER_PAGE = 12;

type Props = {
  posts: BlogPostCard[];
  total: number;
  locale: Locale;
  d: Dict;
};

// Owns the whole feed: cards, empty state and pager.
//
// The category chips are plain links to /blog?category=<slug>, and /blog is a
// static ISR page that never reads searchParams — so before this component
// existed in its current form, clicking a chip changed the URL and highlighted
// the chip while the list below it stayed exactly as prerendered. Nothing
// applied the filter. That work happens here now: the URL stays the source of
// truth (shareable, back-button-able, crawlable) and the rows are re-fetched
// from /api/search/blog whenever it changes.
export function BlogListClient({ posts, total: initialTotal, locale, d }: Props) {
  const L = (path: string) => localeHref(locale, path);

  const [rows, setRows] = useState<BlogPostCard[]>(posts);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);

  const { page, perPage } = usePageParams(BLOG_PER_PAGE);
  const category = useUrlSearchParams().get('category') || '';
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      // The prerendered HTML already IS the unfiltered first page, so a visitor
      // landing on a bare /blog needs no request at all. Anyone arriving
      // straight at ?category= or ?page= falls through and fetches.
      if (!category && page === 1 && perPage === BLOG_PER_PAGE) return;
    }

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      setIsLoading(true);
      const params = new URLSearchParams({
        locale,
        page: String(page),
        perPage: String(perPage),
      });
      if (category) params.set('category', category);

      try {
        const res = await fetch(`/api/search/blog?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        if (cancelled) return;
        setRows(data.rows || []);
        setTotal(data.total || 0);
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError' && !cancelled) {
          console.error('Failed to fetch blog posts:', error);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [category, page, perPage, locale]);

  const totalPages = Math.ceil(total / perPage);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 min-[900px]:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-[300px] rounded-[18px]" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <AnimatedGrid className="rounded-2xl border border-dashed border-line bg-white p-12 text-center text-ink-faint">
        {d.no_articles}
      </AnimatedGrid>
    );
  }

  return (
    <div>
      <AnimatedGrid className="grid grid-cols-1 gap-5 sm:grid-cols-2 min-[900px]:grid-cols-3">
        {rows.map((b) => (
          <Link
            key={b.id}
            href={L(`/blog/${b.slug}`)}
            className="block overflow-hidden rounded-[18px] border border-line bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-cardhover"
          >
            <div className="relative h-40 overflow-hidden bg-brand-50">
              {b.cover_url && <Image src={b.cover_url} alt={b.title} fill sizes="(max-width:640px) 100vw, 360px" className="object-cover" />}
            </div>
            <div className="px-5 py-[18px]">
              <div className="mb-2 text-[12.5px] text-ink-ghost">
                {b.category ? `${b.category} · ` : ''}
                {b.published_at ? fmtDate(b.published_at, locale) : ''}
              </div>
              <div className="mb-2.5 font-heading text-[17px] font-semibold leading-normal text-ink">{b.title}</div>
              <span className="text-sm font-semibold text-brand-600">{d.read_more}</span>
            </div>
          </Link>
        ))}
      </AnimatedGrid>

      <Pagination
        page={page}
        totalPages={totalPages}
        perPage={perPage}
        locale={locale}
        showPerPageSelector
      />
    </div>
  );
}
