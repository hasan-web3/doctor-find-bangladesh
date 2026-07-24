import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import {
  db,
  areas as areasT,
  districts,
  blogPosts,
  doctors as doctorsT,
  hospitals as hospitalsT,
  specialties as specialtiesT,
} from "@/db";
import { siteUrl } from "@/lib/seo-utils";
import { localeHref } from "@/lib/i18n";

// Refresh hourly on the ISR clock; admin mutations also call
// revalidateTag("sitemap") from src/lib/revalidate.ts for instant refresh.
export const revalidate = 3600;

// Google accepts up to 50 000 URLs per sub-sitemap. We chunk at 40 000 to
// leave headroom for the hreflang duplication (each logical entry emits two
// <url> elements, one per locale — the count Next sees == entries.length).
const URLS_PER_SHARD = 40_000;

// Semantic sub-sitemap IDs. generateSitemaps() returns these to Next, which
// wires up an index at /sitemap.xml with children at /sitemap/<id>.xml.
// Growing entity types are shard-suffixed by index below (e.g. `doctors-2`).
type Section =
  | "core"
  | "doctors"
  | "specialties"
  | "areas"
  | "hospitals"
  | "blog"
  | "specialty-area";

type ShardId = { section: Section; page: number };

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// Every logical URL ships in both locales with an hreflang alternates cluster
// — identical across peers, matching the metadata builder (which also emits
// x-default). Google treats them as one canonical entry per locale.
function entry(
  path: string,
  lastModified: Date | string,
  changeFrequency: "daily" | "weekly" | "monthly",
  priority: number,
): MetadataRoute.Sitemap {
  const bnUrl = siteUrl(localeHref("bn", path));
  const enUrl = siteUrl(localeHref("en", path));
  const alternates = {
    languages: { "bn-BD": bnUrl, en: enUrl, "x-default": bnUrl },
  };
  const mod = new Date(lastModified);
  return [
    { url: bnUrl, lastModified: mod, changeFrequency, priority, alternates },
    { url: enUrl, lastModified: mod, changeFrequency, priority, alternates },
  ];
}

// Serialize an ID for Next. The framework only accepts JSON-serialisable
// scalars, so we encode `{section, page}` as `section` (for page 0) or
// `section-<n>` (for subsequent shards) — this is what appears in the URL.
function encodeId({ section, page }: ShardId): string {
  return page === 0 ? section : `${section}-${page + 1}`;
}

function decodeId(id: string): ShardId {
  const m = id.match(/^(.*?)(?:-(\d+))?$/);
  const section = (m?.[1] ?? id) as Section;
  const page = m?.[2] ? Number(m[2]) - 1 : 0;
  return { section, page };
}

// Chunk an array without allocating extra copies of the payload.
function shardCount(total: number): number {
  return Math.max(1, Math.ceil(total / URLS_PER_SHARD));
}

function shardSlice<T>(rows: T[], page: number): T[] {
  const start = page * URLS_PER_SHARD;
  return rows.slice(start, start + URLS_PER_SHARD);
}

// ---------------------------------------------------------------------------
// generateSitemaps: declares which sub-sitemaps exist. Next builds the index
// automatically from this list.
// ---------------------------------------------------------------------------

export async function generateSitemaps(): Promise<{ id: string }[]> {
  const ids: ShardId[] = [{ section: "core", page: 0 }];

  try {
    const [doctorCount, specialtyCount, areaCount, hospitalCount, blogCount] =
      await Promise.all([
        db
          .select({ id: doctorsT.id })
          .from(doctorsT)
          .where(eq(doctorsT.active, true))
          .then((r) => r.length),
        db
          .select({ id: specialtiesT.id })
          .from(specialtiesT)
          .where(eq(specialtiesT.active, true))
          .then((r) => r.length),
        db
          .select({ id: areasT.id })
          .from(areasT)
          .where(eq(areasT.active, true))
          .then((r) => r.length),
        db
          .select({ id: hospitalsT.id })
          .from(hospitalsT)
          .where(eq(hospitalsT.active, true))
          .then((r) => r.length),
        db
          .select({ id: blogPosts.id })
          .from(blogPosts)
          .where(eq(blogPosts.published, true))
          .then((r) => r.length),
      ]);

    for (let p = 0; p < shardCount(doctorCount * 2); p++)
      ids.push({ section: "doctors", page: p });
    for (let p = 0; p < shardCount(specialtyCount * 2); p++)
      ids.push({ section: "specialties", page: p });
    for (let p = 0; p < shardCount(areaCount * 2); p++)
      ids.push({ section: "areas", page: p });
    for (let p = 0; p < shardCount(hospitalCount * 2); p++)
      ids.push({ section: "hospitals", page: p });
    for (let p = 0; p < shardCount(blogCount * 2); p++)
      ids.push({ section: "blog", page: p });
    // specialty × area is the programmatic matrix — usually the largest set.
    for (let p = 0; p < shardCount(specialtyCount * areaCount * 2); p++)
      ids.push({ section: "specialty-area", page: p });
  } catch {
    // DB unreachable during first build: fall back to only the core shard so
    // the site still boots and Google gets at least the static routes.
  }

  return ids.map((id) => ({ id: encodeId(id) }));
}

// ---------------------------------------------------------------------------
// sitemap(id): emits the URL set for one sub-sitemap.
// ---------------------------------------------------------------------------

export default async function sitemap({
  id,
}: {
  id: string;
}): Promise<MetadataRoute.Sitemap> {
  const { section, page } = decodeId(id);
  const now = new Date();

  if (section === "core") {
    // Curated top-level routes. Priorities calibrated so the home and doctor
    // listing outrank marketing pages in Google's crawl budget.
    return [
      ...entry("/", now, "daily", 1.0),
      ...entry("/doctors", now, "daily", 0.9),
      ...entry("/specialties", now, "weekly", 0.8),
      ...entry("/area", now, "weekly", 0.8),
      ...entry("/hospitals", now, "weekly", 0.7),
      ...entry("/blog", now, "weekly", 0.7),
      ...entry("/for-doctors", now, "monthly", 0.6),
      ...entry("/contact", now, "monthly", 0.5),
      ...entry("/about", now, "monthly", 0.5),
    ];
  }

  try {
    if (section === "doctors") {
      const rows = await db
        .select({ slug: doctorsT.slug, updated_at: doctorsT.updatedAt })
        .from(doctorsT)
        .where(eq(doctorsT.active, true));
      // Two <url> entries per logical row, so we chunk after entry expansion.
      const expanded = rows.flatMap((d) =>
        entry(`/doctors/${d.slug}`, d.updated_at, "weekly", 0.8),
      );
      return shardSlice(expanded, page);
    }

    if (section === "specialties") {
      const rows = await db
        .select({ slug: specialtiesT.slug, updated_at: specialtiesT.updatedAt })
        .from(specialtiesT)
        .where(eq(specialtiesT.active, true));
      const expanded = rows.flatMap((s) =>
        entry(`/specialties/${s.slug}`, s.updated_at, "weekly", 0.8),
      );
      return shardSlice(expanded, page);
    }

    if (section === "areas") {
      const rows = await db
        .select({
          slug: areasT.slug,
          districtSlug: districts.slug,
          updated_at: areasT.updatedAt,
        })
        .from(areasT)
        .leftJoin(districts, eq(areasT.districtId, districts.id))
        .where(eq(areasT.active, true));
      const expanded = rows.flatMap((a) =>
        a.districtSlug && a.slug
          ? entry(
              `/area/doctors/${a.districtSlug}/${a.slug}`,
              a.updated_at,
              "weekly",
              0.8,
            )
          : [],
      );
      return shardSlice(expanded, page);
    }

    if (section === "hospitals") {
      const rows = await db
        .select({ slug: hospitalsT.slug, updated_at: hospitalsT.updatedAt })
        .from(hospitalsT)
        .where(eq(hospitalsT.active, true));
      const expanded = rows.flatMap((h) =>
        entry(`/hospitals/${h.slug}`, h.updated_at, "monthly", 0.6),
      );
      return shardSlice(expanded, page);
    }

    if (section === "blog") {
      const rows = await db
        .select({ slug: blogPosts.slug, updated_at: blogPosts.updatedAt })
        .from(blogPosts)
        .where(eq(blogPosts.published, true));
      const expanded = rows.flatMap((p) =>
        entry(`/blog/${p.slug}`, p.updated_at, "monthly", 0.6),
      );
      return shardSlice(expanded, page);
    }

    if (section === "specialty-area") {
      // The programmatic money-page matrix: every active specialty × every
      // active area. Slug pair is the canonical URL for local specialist
      // search intent ("cardiologist in Sonadanga").
      const [specialties, areas] = await Promise.all([
        db
          .select({ slug: specialtiesT.slug })
          .from(specialtiesT)
          .where(eq(specialtiesT.active, true)),
        db
          .select({
            slug: areasT.slug,
            districtSlug: districts.slug,
            updated_at: areasT.updatedAt,
          })
          .from(areasT)
          .leftJoin(districts, eq(areasT.districtId, districts.id))
          .where(eq(areasT.active, true)),
      ]);
      const expanded: MetadataRoute.Sitemap = [];
      for (const s of specialties) {
        if (!s.slug) continue;
        for (const a of areas) {
          if (!a.districtSlug || !a.slug) continue;
          expanded.push(
            ...entry(
              `/specialties/${s.slug}/${a.districtSlug}/${a.slug}`,
              a.updated_at ?? now,
              "weekly",
              0.7,
            ),
          );
        }
      }
      return shardSlice(expanded, page);
    }
  } catch {
    // DB errors during a shard build: return empty rather than 500, so the
    // index and other shards stay serviceable.
    return [];
  }

  return [];
}
