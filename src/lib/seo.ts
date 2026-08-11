import "server-only";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db, redirects, seoOverrides } from "@/db";
import { getSettings } from "./settings";
import { t, localeHref, ogLocale, type Locale, type MLText } from "./i18n";
import { siteUrl, brandIdentity } from "./seo-utils";

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
  // Admin form documents `%s` as the placeholder, but bare `%` slips in often
  // enough to be worth tolerating — fill it with the page title too. Match
  // `%s` first so the more specific token wins on a `%s | brand` template.
  const rawTemplate = t(settings.seo_title_template, locale) || "%s";
  const template = rawTemplate.includes("%s")
    ? rawTemplate
    : rawTemplate.replace(/(^|[^%])%(?!s)/g, `$1%s`);
  const title = (ovTitle || input.noTemplate) ? rawTitle : template.replace("%s", rawTitle);
  const description = ovDesc || input.description || t(settings.seo_default_description, locale);

  // Order of preference for the share card:
  //   1. per-URL admin override
  //   2. the page's own image (doctor photo, blog cover, hospital photo)
  //   3. on the HOME PAGE ONLY, the brand card uploaded in admin > SEO settings
  //   4. the generated /api/og card, titled with this page's own title
  //
  // Step 3 used to be missing entirely: `seo_default_og_image` was read only by
  // brandOgImage() (the intake form), so an admin who uploaded a brand card saw
  // the home page keep advertising the generated card instead.
  //
  // It is deliberately scoped to "/" rather than applied as a site-wide
  // fallback. The uploaded card is one fixed image; letting it cover every
  // image-less page (specialties, districts, contact, FAQ) would give all of
  // them an identical preview, whereas the generated card carries each page's
  // own title and so describes what was actually shared. The brand card's job
  // is to represent the domain itself, which is exactly the home page — the
  // same reasoning brandOgImage() below applies for the intake form.
  const generatedOg = siteUrl(
    `/api/og?title=${encodeURIComponent(input.ogTitle || rawTitle)}&subtitle=${encodeURIComponent(input.ogSubtitle || "")}&locale=${locale}`
  );
  const brandCard = input.path === "/" ? settings.seo_default_og_image?.trim() : "";
  const ogImage = ov?.og_image_url?.trim() || input.ogImage || brandCard || generatedOg;

  // width/height are a layout hint the crawlers trust BEFORE they fetch the
  // file. Declaring 1200x630 over a portrait doctor photo or an arbitrary
  // upload makes Facebook fall back to its small thumbnail card once the real
  // pixels disagree, so only the generated card — the one image whose size we
  // actually control — carries dimensions.
  const ogImageEntry =
    ogImage === generatedOg ? { url: ogImage, width: 1200, height: 630 } : { url: ogImage };

  const q = input.canonicalQuery && input.canonicalQuery.startsWith("?") ? input.canonicalQuery : "";
  const bnUrl = siteUrl(localeHref("bn", input.path)) + q;
  const enUrl = siteUrl(localeHref("en", input.path)) + q;
  const canonical = siteUrl(localeHref(locale, input.path)) + q;

  // og:site_name is one of the candidates Google scores when it decides what to
  // print above the blue title, so it must say the same thing as the WebSite
  // JSON-LD on every page — a bn/en split there is what let the domain win.
  // See brandIdentity() in seo-utils.ts.
  const siteName = brandIdentity(settings.site_name, settings.brand_name).name;

  const ogType = input.ogType || "website";
  const openGraph: Metadata["openGraph"] =
    ogType === "article"
      ? {
          title,
          description,
          url: canonical,
          siteName,
          locale: ogLocale(locale),
          alternateLocale: locale === "bn" ? "en_US" : "bn_BD",
          type: "article",
          publishedTime: input.article?.publishedTime,
          modifiedTime: input.article?.modifiedTime,
          section: input.article?.section,
          authors: input.article?.authors,
          images: [ogImageEntry],
        }
      : {
          title,
          description,
          url: canonical,
          siteName,
          locale: ogLocale(locale),
          alternateLocale: locale === "bn" ? "en_US" : "bn_BD",
          type: "website",
          images: [ogImageEntry],
        };

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical,
      // `bn` AND `bn-BD` both point at the Bangla URL, on purpose.
      //
      // `bn-BD` only matches Bengali speakers whose region resolves to
      // Bangladesh. Bare `bn` matches ANY Bengali-language user — West Bengal,
      // the diaspora, or anyone whose Google region is unset. Without it those
      // searchers fall through to `en`, which is why English URLs kept winning.
      //
      // Order matters for readability only; Google picks the most specific
      // match. Any change here must be mirrored in entry() in sitemap-core.ts —
      // if the XML alternates and these tags disagree, Google discards the
      // whole hreflang cluster and picks a version on its own.
      languages: {
        bn: bnUrl,
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

/**
 * The site-wide brand OG image: the card the main domain shows when its URL is
 * pasted into WhatsApp, Messenger or Facebook.
 *
 * Exists for the pages that live OUTSIDE the [locale] tree and therefore never
 * go through buildMetadata() — today that is the doctor intake form, which still
 * has to look like us when the link is shared with a client. It follows the same
 * order of preference buildMetadata uses for the home page, so the two never
 * disagree:
 *
 *   1. an admin SEO override on "/" — literally the main domain's own image
 *   2. the site-wide default the admin set in SEO settings
 *   3. the generated card at /api/og, which is what every other page falls back
 *      to, titled with the site's default title so it reads as the brand
 *
 * Always an absolute URL: preview crawlers do not resolve relative paths, and
 * pages outside [locale] have no metadataBase to resolve them against.
 */
export async function brandOgImage(): Promise<string> {
  const [settings, overrides] = await Promise.all([getSettings(), getOverrides()]);

  const homeOverride = overrides["/"]?.og_image_url?.trim();
  if (homeOverride) return homeOverride;

  const declared = settings.seo_default_og_image?.trim();
  if (declared) return declared;

  const title = t(settings.seo_default_title, "bn");
  return siteUrl(`/api/og?title=${encodeURIComponent(title)}&subtitle=&locale=bn`);
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

// Canonical suffix for a paginated listing. Page 2+ must canonicalise to
// ITSELF, not back to page 1 — pointing every page at page 1 tells Google the
// deeper pages are duplicates, and it stops indexing the listings (and the
// links on them) entirely. Page 1 keeps the bare path so /doctors and
// /doctors?page=1 never compete.
export function pageCanonicalQuery(page?: string): string | undefined {
  const n = Number(page);
  return Number.isFinite(n) && n > 1 ? `?page=${n}` : undefined;
}
