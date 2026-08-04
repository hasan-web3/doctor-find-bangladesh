import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { getBlogPosts, getBlogCategories } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, date as fmtDate, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AnimatedGrid } from "@/components/animated-grid";
import { BlogListClient } from "@/components/public/blog-list-client";
import { BlogCategoryChips } from "@/components/public/blog-category-chips";
import { Pagination } from "@/components/public/pagination";

// ISR: new posts should surface quickly.
export const revalidate = 900;

// See the note in ../areas/page.tsx: reading searchParams anywhere in a route
// forces `ƒ Dynamic`. The server renders the canonical first page of the
// unfiltered feed; ?category= and ?page= are applied on the client.
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: "/blog",
    title: locale === "bn" ? "স্বাস্থ্য টিপস ও ব্লগ" : "Health Tips & Blog",
    description:
      locale === "bn"
        ? "সুস্থ থাকার সহজ পরামর্শ ও বিশেষজ্ঞদের লেখা স্বাস্থ্য বিষয়ক আর্টিকেল পড়ুন।"
        : "Read simple advice and expert-written health articles for staying healthy.",
  });
}

export default async function BlogPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);

  const page = 1;
  const perPage = 12;

  const [{ rows: posts, total }, categories] = await Promise.all([
    getBlogPosts(locale, { page, perPage }),
    getBlogCategories(locale),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <Breadcrumbs locale={locale} items={[{ name: d.breadcrumb_home, path: "/" }, { name: d.nav_blog }]} />
      <h1 className="mb-1.5 font-heading text-[clamp(26px,4vw,34px)] font-bold text-ink">{d.blog_title}</h1>
      <p className="mb-5 text-base text-ink-mute">{d.blog_sub}</p>

      <BlogCategoryChips categories={categories} locale={locale} allLabel={d.all} />

      {posts.length > 0 ? (
        <>
          <BlogListClient posts={posts} locale={locale} d={d} />
          <Pagination
            page={page}
            totalPages={totalPages}
            perPage={perPage}
            locale={locale}
            showPerPageSelector
          />
        </>
      ) : (
        <AnimatedGrid className="rounded-2xl border border-dashed border-line bg-white p-12 text-center text-ink-faint">
          {d.no_articles}
        </AnimatedGrid>
      )}
    </div>
  );
}
