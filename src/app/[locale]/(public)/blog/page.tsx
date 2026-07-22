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
import { Pagination } from "@/components/public/pagination";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ category?: string; page?: string; perPage?: string }> };

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

export default async function BlogPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);
  const sp = await searchParams;

  const page = Number(sp.page || "1");
  const perPage = Number(sp.perPage || "12");

  const [{ rows: posts, total }, categories] = await Promise.all([
    getBlogPosts(locale, { page, perPage, category: sp.category }),
    getBlogCategories(locale),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <Breadcrumbs locale={locale} items={[{ name: d.breadcrumb_home, path: "/" }, { name: d.nav_blog }]} />
      <h1 className="mb-1.5 font-heading text-[clamp(26px,4vw,34px)] font-bold text-ink">{d.blog_title}</h1>
      <p className="mb-5 text-base text-ink-mute">{d.blog_sub}</p>

      {categories.length > 0 && (
        <div className="mb-[26px] flex flex-wrap gap-2">
          <Link
            href={L("/blog")}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold",
              !sp.category ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink-soft"
            )}
          >
            {d.all}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`${L("/blog")}?category=${c.slug}`}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold",
                sp.category === c.slug ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white text-ink-soft"
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

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
