import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db, areas as areasT, districts, blogPosts, doctors as doctorsT, hospitals as hospitalsT, specialties as specialtiesT } from "@/db";
import { siteUrl } from "@/lib/seo-utils";
import { localeHref } from "@/lib/i18n";

export const revalidate = 3600; // also refreshed instantly via revalidateTag("sitemap")

// Every page ships in both locales: bn at root, en under /en,
// each entry carrying hreflang alternates for Google.
function entry(
  path: string,
  lastModified: Date | string,
  changeFrequency: "daily" | "weekly" | "monthly",
  priority: number
): MetadataRoute.Sitemap {
  const bnUrl = siteUrl(localeHref("bn", path));
  const enUrl = siteUrl(localeHref("en", path));
  // hreflang cluster must be identical across peers, and match the metadata
  // builder (which also emits x-default). Equal priority — neither variant is
  // secondary; both ship in full.
  const alternates = { languages: { "bn-BD": bnUrl, en: enUrl, "x-default": bnUrl } };
  return [
    { url: bnUrl, lastModified: new Date(lastModified), changeFrequency, priority, alternates },
    { url: enUrl, lastModified: new Date(lastModified), changeFrequency, priority, alternates },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    ...entry("/", now, "daily", 1),
    ...entry("/doctors", now, "daily", 0.9),
    ...entry("/specialties", now, "weekly", 0.8),
    ...entry("/area", now, "weekly", 0.8),
    ...entry("/hospitals", now, "weekly", 0.7),
    ...entry("/blog", now, "weekly", 0.7),
    ...entry("/for-doctors", now, "monthly", 0.6),
    ...entry("/contact", now, "monthly", 0.5),
    ...entry("/about", now, "monthly", 0.5),
  ];

  try {
    const [doctors, specialties, areas, hospitals, posts] = await Promise.all([
      db.select({ slug: doctorsT.slug, updated_at: doctorsT.updatedAt }).from(doctorsT).where(eq(doctorsT.active, true)),
      db.select({ slug: specialtiesT.slug, updated_at: specialtiesT.updatedAt }).from(specialtiesT).where(eq(specialtiesT.active, true)),
      db.select({ slug: areasT.slug, districtSlug: districts.slug, updated_at: areasT.updatedAt }).from(areasT).leftJoin(districts, eq(areasT.districtId, districts.id)).where(eq(areasT.active, true)),
      db.select({ slug: hospitalsT.slug, updated_at: hospitalsT.updatedAt }).from(hospitalsT).where(eq(hospitalsT.active, true)),
      db.select({ slug: blogPosts.slug, updated_at: blogPosts.updatedAt }).from(blogPosts).where(eq(blogPosts.published, true)),
    ]);

    for (const doc of doctors) entries.push(...entry(`/doctors/${doc.slug}`, doc.updated_at, "weekly", 0.8));
    for (const s of specialties) entries.push(...entry(`/specialties/${s.slug}`, s.updated_at, "weekly", 0.8));
    for (const a of areas) {
      if (a.districtSlug && a.slug) {
        entries.push(...entry(`/area/doctors/${a.districtSlug}/${a.slug}`, a.updated_at, "weekly", 0.8));
      }
    }
    // Programmatic specialty+area combination pages: the "money pages".
    for (const s of specialties) {
      for (const a of areas) {
        if (s.slug && a.districtSlug && a.slug) {
          entries.push(...entry(`/specialties/${s.slug}/${a.districtSlug}/${a.slug}`, now, "weekly", 0.7));
        }
      }
    }
    for (const h of hospitals) entries.push(...entry(`/hospitals/${h.slug}`, h.updated_at, "monthly", 0.6));
    for (const p of posts) entries.push(...entry(`/blog/${p.slug}`, p.updated_at, "monthly", 0.6));
  } catch {
    // DB not ready during first build; static entries still ship.
  }

  return entries;
}
