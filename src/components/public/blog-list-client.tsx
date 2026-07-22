'use client';

import Link from 'next/link';
import Image from 'next/image';
import { AnimatedGrid } from '@/components/animated-grid';
import { type Locale, localeHref, date as fmtDate } from '@/lib/i18n';
import { type getBlogPosts } from '@/lib/data';
import { type getDict } from '@/lib/dict';

type Posts = Awaited<ReturnType<typeof getBlogPosts>>['rows'];
type Dict = ReturnType<typeof getDict>;

type Props = {
  posts: Posts;
  locale: Locale;
  d: Dict;
};

export function BlogListClient({ posts, locale, d }: Props) {
  const L = (path: string) => localeHref(locale, path);

  return (
    <AnimatedGrid className="grid grid-cols-1 gap-5 sm:grid-cols-2 min-[900px]:grid-cols-3">
      {posts.map((b) => (
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
  );
}
