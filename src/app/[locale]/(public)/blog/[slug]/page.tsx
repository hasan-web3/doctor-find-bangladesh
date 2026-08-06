import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { getBlogPostBySlug, getAllBlogSlugs } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { buildMetadata, findRedirect } from "@/lib/seo";
import { ldArticle, brandIdentity } from "@/lib/seo-utils";
import { sanitizeHtml } from "@/lib/sanitize";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, date as fmtDate, type Locale } from "@/lib/i18n";

// ISR: detail; purged by path on edit.
export const revalidate = 43200;

// Enumerated so these pages are PRERENDERED at build and then served from the
// ISR cache. An un-enumerated dynamic segment is re-rendered on every single
// request (verified against a production build: prebuilt params answer with
// `s-maxage`, un-enumerated ones with `private, no-store`).
//
// `dynamicParams` stays at its default (true), so a slug added after this
// deploy still resolves — it renders once, then caches like the rest.
export async function generateStaticParams() {
  const slugs = await getAllBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}


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
      <JsonLd data={ldArticle(post, brandIdentity(settings.site_name, settings.brand_name), locale)} />
      <Breadcrumbs
        locale={locale}
        items={[{ name: d.breadcrumb_home, path: "/" }, { name: d.nav_blog, path: "/blog" }, { name: post.title }]}
      />

      {/* Article body: on md+ the cover is floated so the meta/title/excerpt
          AND the first paragraphs of content wrap around it; once the text
          runs past the image height, it reclaims the full column width — no
          empty column, no ragged gap between the hero and the first heading.
          On mobile the float doesn't kick in, so the image simply stacks
          after the title at a tighter 16:10 aspect ratio. */}
      <article>
        <div className="mb-2.5 text-[13.5px] font-bold text-brand-600">
          {post.category ? `${post.category} · ` : ""}
          {post.published_at ? fmtDate(post.published_at, locale) : ""}
        </div>
        <h1 className="mb-3 font-heading text-[clamp(24px,3.4vw,32px)] font-bold leading-[1.25] text-ink">{post.title}</h1>
        {post.excerpt && (
          <p className="mb-5 text-[15.5px] leading-relaxed text-ink-mute">{post.excerpt}</p>
        )}
        {post.cover_url && (
          <div className="mb-5 md:float-right md:ml-6 md:mb-3 md:mt-1 md:w-[44%] md:max-w-[520px]">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-brand-50 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)] ring-1 ring-line">
              <Image
                src={post.cover_url}
                alt={post.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 45vw, 520px"
                className="object-cover"
              />
            </div>
          </div>
        )}
        <div className="prose-bn max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content_html) }} />
        {/* Clear the float so anything after the article sits below the
            image on short posts where the copy doesn't already exceed it. */}
        <div className="clear-both" />
      </article>

      {/* Sidebar cards moved BELOW the article on every viewport — the
          desktop column was creating a visible width mismatch with the
          hero image and left a lot of dead space in short posts. */}
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
  );
}
