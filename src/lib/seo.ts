import "server-only";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db, redirects, seoOverrides } from "@/db";
import { getSettings } from "./settings";
import { t, localeHref, ogLocale, type Locale, type MLText } from "./i18n";
import { siteUrl } from "./seo-utils";

const getOverrides = unstable_cache(
  async () => {
    try {
      const rows = await db
        .select({
          path: seoOverrides.path,
          meta_title: seoOverrides.metaTitle,
          meta_description: seoOverrides.metaDescription,
          og_image_url: seoOverrides.ogImageUrl,
        })
        .from(seoOverrides);
      const map: Record<string, (typeof rows)[number]> = {};
      for (const r of rows) map[r.path] = r;
      return map;
    } catch {
      return {} as Record<string, { path: string; meta_title: MLText; meta_description: MLText; og_image_url: string | null }>;
    }
  },
  ["seo-overrides"],
  { tags: ["seo"] }
);

type MetaInput = {
  locale: Locale;
  path: string;              // locale-neutral path, e.g. /doctors/dr-rafiq
  title: string;             // localized page title (without template)
  description: string;
  ogTitle?: string;
  ogSubtitle?: string;
  ogImage?: string;
  noTemplate?: boolean;
  noindex?: boolean;
  // Appended verbatim to the canonical URL (must start with "?"). Use for
  // paginated list pages so ?page=2+ gets its own canonical instead of
  // collapsing into ?page=1.
  canonicalQuery?: string;
  ogType?: "website" | "article";
  article?: {
    publishedTime?: string;  // ISO 8601
    modifiedTime?: string;   // ISO 8601
    section?: string;
    authors?: string[];
  };
};

// Central metadata builder with bilingual SEO:
// per-URL admin overrides > page values > site defaults, plus hreflang
// alternates so Google indexes both bn (root) and en (/en) versions.
export async function buildMetadata(input: MetaInput): Promise<Metadata> {
  const { locale } = input;
  const [settings, overrides] = await Promise.all([getSettings(), getOverrides()]);
  const ov = overrides[input.path];
  const ovTitle = ov ? t(ov.meta_title, locale) : "";
  const ovDesc = ov ? t(ov.meta_description, locale) : "";

  const rawTitle = ovTitle || input.title || t(settings.seo_default_title, locale);
  const template = t(settings.seo_title_template, locale) || "%s";
  const title = (ovTitle || input.noTemplate) ? rawTitle : template.replace("%s", rawTitle);
  const description = ovDesc || input.description || t(settings.seo_default_description, locale);

  const ogImage =
    ov?.og_image_url ||
    input.ogImage ||
    siteUrl(`/api/og?title=${encodeURIComponent(input.ogTitle || rawTitle)}&subtitle=${encodeURIComponent(input.ogSubtitle || "")}&locale=${locale}`);

  const q = input.canonicalQuery && input.canonicalQuery.startsWith("?") ? input.canonicalQuery : "";
  const bnUrl = siteUrl(localeHref("bn", input.path)) + q;
  const enUrl = siteUrl(localeHref("en", input.path)) + q;
  const canonical = siteUrl(localeHref(locale, input.path)) + q;

  const ogType = input.ogType || "website";
  const openGraph: Metadata["openGraph"] =
    ogType === "article"
      ? {
          title,
          description,
          url: canonical,
          siteName: t(settings.brand_name, locale),
          locale: ogLocale(locale),
          alternateLocale: locale === "bn" ? "en_US" : "bn_BD",
          type: "article",
          publishedTime: input.article?.publishedTime,
          modifiedTime: input.article?.modifiedTime,
          section: input.article?.section,
          authors: input.article?.authors,
          images: [{ url: ogImage, width: 1200, height: 630 }],
        }
      : {
          title,
          description,
          url: canonical,
          siteName: t(settings.brand_name, locale),
          locale: ogLocale(locale),
          alternateLocale: locale === "bn" ? "en_US" : "bn_BD",
          type: "website",
          images: [{ url: ogImage, width: 1200, height: 630 }],
        };

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical,
      languages: {
        "bn-BD": bnUrl,
        en: enUrl,
        "x-default": bnUrl,
      },
    },
    robots: input.noindex ? { index: false, follow: false } : undefined,
    openGraph,
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

// When a slug changes, keep the old URL alive with a permanent redirect.
export async function recordSlugChange(oldPath: string, newPath: string) {
  if (oldPath === newPath) return;
  await db
    .insert(redirects)
    .values({ fromPath: oldPath, toPath: newPath, permanent: true })
    .onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: newPath } });
  // Retarget any prior redirect that pointed at the old path so chains collapse.
  await db.update(redirects).set({ toPath: newPath }).where(eq(redirects.toPath, oldPath));
  await db.delete(redirects).where(sql`${redirects.fromPath} = ${redirects.toPath}`);
}

export async function findRedirect(path: string) {
  const [row] = await db
    .select({ to_path: redirects.toPath, permanent: redirects.permanent })
    .from(redirects)
    .where(eq(redirects.fromPath, path))
    .limit(1);
  return row ?? null;
}
