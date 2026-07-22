import "server-only";
import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { staticPages } from "@/db/schema";
import { t, type Locale, type MLText } from "./i18n";

// Fixed set of admin-editable static pages. Adding a new slug here is
// intentionally two steps: add to this union AND seed the row — this keeps
// the public route from serving an unbounded slug list to bots.
export const STATIC_PAGE_SLUGS = ["privacy", "terms"] as const;
export type StaticPageSlug = (typeof STATIC_PAGE_SLUGS)[number];

export function isStaticPageSlug(v: string): v is StaticPageSlug {
  return (STATIC_PAGE_SLUGS as readonly string[]).includes(v);
}

export type LocalizedStaticPage = {
  slug: StaticPageSlug;
  title: string;
  meta_description: string;
  content: string;
  updated_at: string;
};

// Tag `static-pages` — admin save invalidates so edits appear immediately.
export const getStaticPage = unstable_cache(
  async (slug: StaticPageSlug, locale: Locale): Promise<LocalizedStaticPage | null> => {
    const [row] = await db
      .select({
        slug: staticPages.slug,
        title: staticPages.title,
        meta_description: staticPages.metaDescription,
        content: staticPages.content,
        updated_at: staticPages.updatedAt,
      })
      .from(staticPages)
      .where(eq(staticPages.slug, slug))
      .limit(1);
    if (!row) return null;
    return {
      slug: row.slug as StaticPageSlug,
      title: t(row.title as MLText, locale),
      meta_description: t(row.meta_description as MLText, locale),
      content: t(row.content as MLText, locale),
      updated_at: row.updated_at.toISOString(),
    };
  },
  ["static-page"],
  { tags: ["static-pages"] }
);

// Raw record for the admin editor (both languages side by side).
export async function getStaticPageRaw(slug: StaticPageSlug) {
  const [row] = await db.select().from(staticPages).where(eq(staticPages.slug, slug)).limit(1);
  return row ?? null;
}
