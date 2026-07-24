import "server-only";
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
import { siteUrl } from "./seo-utils";
import { localeHref } from "./i18n";

// Google accepts up to 50 000 URLs OR 50 MB per sub-sitemap — whichever hits
// first. Each <url> block with the hreflang cluster is ~600 bytes; chunking
// at 8 000 URLs (~5 MB per shard) keeps every file safely under Vercel's
// 19 MB ISR fallback cap AND under Google's own 50 MB sitemap limit.
export const URLS_PER_SHARD = 8_000;

// Semantic sub-sitemap sections. Overflow shards are suffixed by index below
// (e.g. `doctors`, `doctors-2`, `doctors-3`) — the index route enumerates
// every shard automatically, so adding a section here is a one-line change.
export type Section =
  | "core"
  | "doctors"
  | "specialties"
  | "areas"
  | "hospitals"
  | "blog"
  | "specialty-area";

export type ShardId = { section: Section; page: number };

export type SitemapEntry = {
  url: string;
  lastmod: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: number;
  alternates: { hreflang: string; href: string }[];
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function entry(
  path: string,
  lastModified: Date | string,
  changefreq: "daily" | "weekly" | "monthly",
  priority: number,
): SitemapEntry[] {
  const bnUrl = siteUrl(localeHref("bn", path));
  const enUrl = siteUrl(localeHref("en", path));
  const alternates = [
    { hreflang: "bn-BD", href: bnUrl },
    { hreflang: "en", href: enUrl },
    { hreflang: "x-default", href: bnUrl },
  ];
  const lastmod = new Date(lastModified).toISOString();
  return [
    { url: bnUrl, lastmod, changefreq, priority, alternates },
    { url: enUrl, lastmod, changefreq, priority, alternates },
  ];
}

export function encodeShardId({ section, page }: ShardId): string {
  return page === 0 ? section : `${section}-${page + 1}`;
}

export function decodeShardId(raw: string): ShardId {
  // Strip a trailing `.xml` if present so `/sitemap/doctors.xml` maps back
  // to `{ section: "doctors", page: 0 }` cleanly.
  const id = raw.replace(/\.xml$/i, "");
  const m = id.match(/^(.*?)(?:-(\d+))?$/);
  const section = (m?.[1] ?? id) as Section;
  const page = m?.[2] ? Number(m[2]) - 1 : 0;
  return { section, page };
}

// Sections with zero rows produce zero shards — we don't want a phantom
// entry in the sitemap index that then 404s at /sitemap/<section>.xml.
// (Callers can still hard-code "always at least one shard" by passing max=1.)
function shardCount(total: number): number {
  return total <= 0 ? 0 : Math.ceil(total / URLS_PER_SHARD);
}

function shardSlice<T>(rows: T[], page: number): T[] {
  const start = page * URLS_PER_SHARD;
  return rows.slice(start, start + URLS_PER_SHARD);
}

// ---------------------------------------------------------------------------
// listSitemaps — the master list used by the index route AND robots.ts.
// Uses live DB counts to decide how many shards a section needs.
// ---------------------------------------------------------------------------

export async function listSitemaps(): Promise<ShardId[]> {
  const ids: ShardId[] = [{ section: "core", page: 0 }];

  try {
    const [doctorCount, specialtyCount, areaCount, hospitalCount, blogCount] =
      await Promise.all([
        db.select({ id: doctorsT.id }).from(doctorsT).where(eq(doctorsT.active, true)).then((r) => r.length),
        db.select({ id: specialtiesT.id }).from(specialtiesT).where(eq(specialtiesT.active, true)).then((r) => r.length),
        db.select({ id: areasT.id }).from(areasT).where(eq(areasT.active, true)).then((r) => r.length),
        db.select({ id: hospitalsT.id }).from(hospitalsT).where(eq(hospitalsT.active, true)).then((r) => r.length),
        db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.published, true)).then((r) => r.length),
      ]);

    for (let p = 0; p < shardCount(doctorCount * 2); p++) ids.push({ section: "doctors", page: p });
    for (let p = 0; p < shardCount(specialtyCount * 2); p++) ids.push({ section: "specialties", page: p });
    for (let p = 0; p < shardCount(areaCount * 2); p++) ids.push({ section: "areas", page: p });
    for (let p = 0; p < shardCount(hospitalCount * 2); p++) ids.push({ section: "hospitals", page: p });
    for (let p = 0; p < shardCount(blogCount * 2); p++) ids.push({ section: "blog", page: p });
    for (let p = 0; p < shardCount(specialtyCount * areaCount * 2); p++) ids.push({ section: "specialty-area", page: p });
  } catch {
    // DB unreachable during first build: fall back to only the core shard so
    // the site still boots and Google gets at least the static routes.
  }

  return ids;
}

// ---------------------------------------------------------------------------
// buildShard — resolve one section+page into the URL entries to serialise.
// ---------------------------------------------------------------------------

export async function buildShard({ section, page }: ShardId): Promise<SitemapEntry[]> {
  const now = new Date();

  if (section === "core") {
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
      const expanded = rows.flatMap((d) => entry(`/doctors/${d.slug}`, d.updated_at, "weekly", 0.8));
      return shardSlice(expanded, page);
    }

    if (section === "specialties") {
      const rows = await db
        .select({ slug: specialtiesT.slug, updated_at: specialtiesT.updatedAt })
        .from(specialtiesT)
        .where(eq(specialtiesT.active, true));
      const expanded = rows.flatMap((s) => entry(`/specialties/${s.slug}`, s.updated_at, "weekly", 0.8));
      return shardSlice(expanded, page);
    }

    if (section === "areas") {
      const rows = await db
        .select({ slug: areasT.slug, districtSlug: districts.slug, updated_at: areasT.updatedAt })
        .from(areasT)
        .leftJoin(districts, eq(areasT.districtId, districts.id))
        .where(eq(areasT.active, true));
      const expanded = rows.flatMap((a) =>
        a.districtSlug && a.slug ? entry(`/area/doctors/${a.districtSlug}/${a.slug}`, a.updated_at, "weekly", 0.8) : [],
      );
      return shardSlice(expanded, page);
    }

    if (section === "hospitals") {
      const rows = await db
        .select({ slug: hospitalsT.slug, updated_at: hospitalsT.updatedAt })
        .from(hospitalsT)
        .where(eq(hospitalsT.active, true));
      const expanded = rows.flatMap((h) => entry(`/hospitals/${h.slug}`, h.updated_at, "monthly", 0.6));
      return shardSlice(expanded, page);
    }

    if (section === "blog") {
      const rows = await db
        .select({ slug: blogPosts.slug, updated_at: blogPosts.updatedAt })
        .from(blogPosts)
        .where(eq(blogPosts.published, true));
      const expanded = rows.flatMap((p) => entry(`/blog/${p.slug}`, p.updated_at, "monthly", 0.6));
      return shardSlice(expanded, page);
    }

    if (section === "specialty-area") {
      const [specialties, areas] = await Promise.all([
        db.select({ slug: specialtiesT.slug }).from(specialtiesT).where(eq(specialtiesT.active, true)),
        db
          .select({ slug: areasT.slug, districtSlug: districts.slug, updated_at: areasT.updatedAt })
          .from(areasT)
          .leftJoin(districts, eq(areasT.districtId, districts.id))
          .where(eq(areasT.active, true)),
      ]);
      const expanded: SitemapEntry[] = [];
      for (const s of specialties) {
        if (!s.slug) continue;
        for (const a of areas) {
          if (!a.districtSlug || !a.slug) continue;
          expanded.push(
            ...entry(`/specialties/${s.slug}/${a.districtSlug}/${a.slug}`, a.updated_at ?? now, "weekly", 0.7),
          );
        }
      }
      return shardSlice(expanded, page);
    }
  } catch {
    return [];
  }

  return [];
}

// ---------------------------------------------------------------------------
// XML serialisation
// ---------------------------------------------------------------------------

function escapeXml(v: string): string {
  return v.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string),
  );
}

export function renderIndexXml(shards: ShardId[]): string {
  const now = new Date().toISOString();
  const items = shards
    .map((s) => {
      const loc = siteUrl(`/sitemap/${encodeShardId(s)}.xml`);
      return `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`;
    })
    .join("\n");
  // Namespace MUST be `.../sitemap/0.9` (slash, not hyphen). Google Search
  // Console rejects `sitemap-0.9` with "Incorrect namespace" and refuses to
  // fetch any child sitemap in the index — one typo, entire tree unindexed.
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`;
}

export function renderUrlsetXml(entries: SitemapEntry[]): string {
  const items = entries
    .map((e) => {
      const altLinks = e.alternates
        .map((a) => `    <xhtml:link rel="alternate" hreflang="${escapeXml(a.hreflang)}" href="${escapeXml(a.href)}"/>`)
        .join("\n");
      return `  <url>\n    <loc>${escapeXml(e.url)}</loc>\n${altLinks}\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority.toFixed(1)}</priority>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${items}
</urlset>`;
}
