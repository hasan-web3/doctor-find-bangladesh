import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { getBlogPostBySlug } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { buildMetadata, findRedirect } from "@/lib/seo";
import { ldArticle } from "@/lib/seo-utils";
import { sanitizeHtml } from "@/lib/sanitize";
import { getDict } from "@/lib/dict";
import { t, isLocale, localeHref, date as fmtDate, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const post = await getBlogPostBySlug(slug, locale);
  if (!post) return {};
  return buildMetadata({
    locale,
    path: `/blog/${post.slug}`,
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt || post.title,
    ogTitle: post.title,
    ogSubtitle: post.category || (locale === "bn" ? "স্বাস্থ্য টিপস" : "Health Tips"),
    ogImage: post.cover_url || undefined,
    noTemplate: Boolean(post.meta_title),
    ogType: "article",
    article: {
      publishedTime: post.published_at ? new Date(post.published_at).toISOString() : undefined,
      modifiedTime: new Date(post.updated_at).toISOString(),
      section: post.category || undefined,
    },
  });
}

export default async function ArticlePage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);

  const [post, settings] = await Promise.all([getBlogPostBySlug(slug, locale), getSettings()]);
  if (!post) {
    const hit = await findRedirect(`/blog/${slug}`);
    if (hit) {
      const target = L(hit.to_path);
      if (hit.permanent) permanentRedirect(target);
      redirect(target);
    }
    notFound();
  }

  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <JsonLd data={ldArticle(post, t(settings.brand_name, locale), locale)} />
      <Breadcrumbs
        locale={locale}
        items={[{ name: d.breadcrumb_home, path: "/" }, { name: d.nav_blog, path: "/blog" }, { name: post.title }]}
      />

      <div className="mb-2.5 text-[13.5px] font-bold text-brand-600">
        {post.category ? `${post.category} · ` : ""}
        {post.published_at ? fmtDate(post.published_at, locale) : ""}
      </div>
      <h1 className="mb-5 font-heading text-[clamp(26px,4vw,34px)] font-bold leading-[1.3] text-ink">{post.title}</h1>

      {post.cover_url && (
        <div className="relative mb-[26px] h-[320px] sm:h-[400px] md:h-[480px] overflow-hidden rounded-[18px] bg-brand-50">
          <Image src={post.cover_url} alt={post.title} fill priority sizes="(max-width:1400px) 100vw, 1400px" className="object-cover" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="prose-bn max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content_html) }} />
        </div>
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-2xl border border-warm-border bg-warm-soft p-5 text-[15px] text-warm-heavy leading-relaxed">
            {d.article_disclaimer}
          </div>
          <div className="flex flex-col gap-4 rounded-2xl bg-brand-50 p-5 border border-brand-100">
            <div className="text-base font-bold text-brand-900">{d.article_cta}</div>
            <Link href={L("/doctors")} className="block text-center rounded-[11px] bg-brand-600 px-5 py-[11px] text-[14.5px] font-bold text-white transition-colors hover:bg-brand-700">
              {d.find_doctor}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
