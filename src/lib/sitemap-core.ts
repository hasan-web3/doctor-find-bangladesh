import "server-only";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, blogPosts, doctors as doctorsT, redirects } from "@/db";
import { siteUrl } from "./seo-utils";
import { localeHref } from "./i18n";
import { getAllSpecialtySlugs, getAllActiveAreaSlugs } from "./data";

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
  | "districts"
  | "areas"
  | "hospitals"
  | "blog"
  | "specialty-area";

// ---------------------------------------------------------------------------
// CRAWL ORDER. Googlebot walks a sitemap index top-down and spends its budget
// in the order it finds URLs, so this array IS the crawl priority:
//
//   core        entry points — tiny, must be seen first
//   doctors     priority 1: the pages the whole site exists to rank
//   hospitals   priority 2
//   specialties then the hubs, then geo, then the long-tail combos
//
// Changing this array changes what Google reaches first on a partial crawl.
// ---------------------------------------------------------------------------
const SECTION_ORDER: Section[] = [
  "core",
  "doctors",
  "hospitals",
  "specialties",
  "districts",
  "areas",
  "specialty-area",
  "blog",
];

// Base <priority> per section, before the coverage bonus below. Relative
// values are what matter to Google, not the absolute numbers.
const BASE_PRIORITY: Record<Section, number> = {
  core: 0.8,
  doctors: 0.9,
  hospitals: 0.8,
  specialties: 0.7,
  districts: 0.6,
  areas: 0.6,
  "specialty-area": 0.5,
  blog: 0.5,
};

// A landing page listing 40 doctors deserves more crawl attention than one
// listing 1. Nudge <priority> by how much the page actually has to show.
function coveragePriority(section: Section, doctorCount: number): number {
  const base = BASE_PRIORITY[section];
  const bonus = doctorCount >= 10 ? 0.1 : doctorCount >= 3 ? 0.05 : 0;
  return Math.min(1, Math.round((base + bonus) * 10) / 10);
}

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
  // Next normalises `alternates.canonical` and drops the root's trailing
  // slash, so `/` renders as `https://site` while siteUrl("/") yields
  // `https://site/`. Google folds the two together, but an exact match keeps
  // the sitemap loc and the canonical tag byte-identical — no ambiguity about
  // which form is the canonical one. No other path ends in "/".
  const bnUrl = siteUrl(localeHref("bn", path)).replace(/\/$/, "");
  const enUrl = siteUrl(localeHref("en", path)).replace(/\/$/, "");
  // MUST stay byte-identical to the `languages` map in buildMetadata()
  // (src/lib/seo.ts). Google cross-checks the sitemap's alternates against the
  // on-page tags; any disagreement invalidates the cluster and it picks a
  // version on its own. `bn` widens matching beyond Bangladesh-region users.
  const alternates = [
    { hreflang: "bn", href: bnUrl },
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
// THE COVERAGE CHAIN
//
// A URL earns a place in the sitemap only when the whole chain behind it
// resolves. Bagerhat has a Mongla thana row, so /area/doctors/bagerhat/mongla
// renders — but if no doctor practises there the page is empty. Google crawls
// it, indexes nothing, and the URL sits in "Discovered – currently not
// indexed" forever while burning budget the doctor pages needed.
//
// `doctor_area` is the root of the chain: it resolves a doctor to a thana the
// same two ways searchDoctors() does for ?area= —
//
//     doctor -> visible chamber -> thana
//     doctor -> profile hospital -> thana
//
// Every query below then extends that link by link, and each JOIN is a link
// that must hold:
//
//     thana  -> district        (a.district_id -> districts, both active)
//     doctor -> specialty       (doctor_specialties -> specialties, active)
//     doctor -> hospital        (d.hospital_id, for the hospitals section)
//
// Break any link and the row drops out — so a URL exists if and only if its
// page has something to show. Add a doctor and complete a chain, and every
// URL along it appears on the next revalidation. Nothing to maintain by hand.
// ---------------------------------------------------------------------------

// Which thana a doctor belongs to, and it is exactly ONE rule everywhere on the
// site: their visible chambers, and ONLY if they have none, their linked
// hospital. The second branch is a FALLBACK, not an alternative — without the
// NOT EXISTS guard a doctor with a Dhaka chamber and a Khulna hospital was
// listed under both thanas, so the sitemap advertised URLs whose pages did not
// actually contain that doctor once the listing filter disagreed.
const DOCTOR_AREA = sql`
  doctor_area AS (
    SELECT DISTINCT c.doctor_id, c.area_id
      FROM chambers c
     WHERE c.visible AND c.area_id IS NOT NULL
    UNION
    SELECT DISTINCT d.id AS doctor_id, h.area_id
      FROM doctors d
      JOIN hospitals h ON h.id = d.hospital_id
     WHERE h.area_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM chambers cx
          WHERE cx.doctor_id = d.id AND cx.visible AND cx.area_id IS NOT NULL
       )
  )`;

// Every coverage query returns the same shape: the slugs that build the URL,
// how many doctors back it (drives <priority>) and when those doctors last
// changed (drives <lastmod>, so Google re-crawls on real change only).
type Covered = { doctor_count: number; updated_at: string | null };

type PairRow = Covered & { specialty_slug: string; area_slug: string };

// doctor -> thana -> district, AND doctor -> specialty. Both must hold.
async function fetchSpecialtyAreaPairs(): Promise<PairRow[]> {
  const res = await db.execute<PairRow>(sql`
    WITH ${DOCTOR_AREA}
    SELECT s.slug AS specialty_slug,
           a.slug AS area_slug,
           COUNT(DISTINCT d.id)::int AS doctor_count,
           GREATEST(MAX(d.updated_at), MAX(a.updated_at)) AS updated_at
      FROM doctor_area da
      JOIN doctors d ON d.id = da.doctor_id AND d.active
      JOIN doctor_specialties ds ON ds.doctor_id = d.id
      JOIN specialties s ON s.id = ds.specialty_id AND s.active
      JOIN areas a ON a.id = da.area_id AND a.active
      JOIN districts dist ON dist.id = a.district_id AND dist.active
     GROUP BY s.slug, a.slug
     ORDER BY doctor_count DESC, s.slug, a.slug
  `);
  return res.rows;
}

type AreaRow = Covered & { area_slug: string; district_slug: string };

// doctor -> thana -> district.
async function fetchCoveredAreas(): Promise<AreaRow[]> {
  const res = await db.execute<AreaRow>(sql`
    WITH ${DOCTOR_AREA}
    SELECT a.slug AS area_slug,
           dist.slug AS district_slug,
           COUNT(DISTINCT d.id)::int AS doctor_count,
           GREATEST(MAX(d.updated_at), MAX(a.updated_at)) AS updated_at
      FROM doctor_area da
      JOIN doctors d ON d.id = da.doctor_id AND d.active
      JOIN areas a ON a.id = da.area_id AND a.active
      JOIN districts dist ON dist.id = a.district_id AND dist.active
     GROUP BY a.slug, dist.slug
     ORDER BY doctor_count DESC, dist.slug, a.slug
  `);
  return res.rows;
}

type DistrictRow = Covered & { district_slug: string };

// A district qualifies through its thanas: at least one must have a doctor.
async function fetchCoveredDistricts(): Promise<DistrictRow[]> {
  const res = await db.execute<DistrictRow>(sql`
    WITH ${DOCTOR_AREA}
    SELECT dist.slug AS district_slug,
           COUNT(DISTINCT d.id)::int AS doctor_count,
           GREATEST(MAX(d.updated_at), MAX(dist.updated_at)) AS updated_at
      FROM doctor_area da
      JOIN doctors d ON d.id = da.doctor_id AND d.active
      JOIN areas a ON a.id = da.area_id AND a.active
      JOIN districts dist ON dist.id = a.district_id AND dist.active
     GROUP BY dist.slug
     ORDER BY doctor_count DESC, dist.slug
  `);
  return res.rows;
}

type SpecialtyRow = Covered & { specialty_slug: string };

// A specialty hub qualifies once any active doctor holds it.
async function fetchCoveredSpecialties(): Promise<SpecialtyRow[]> {
  const res = await db.execute<SpecialtyRow>(sql`
    SELECT s.slug AS specialty_slug,
           COUNT(DISTINCT d.id)::int AS doctor_count,
           GREATEST(MAX(d.updated_at), MAX(s.updated_at)) AS updated_at
      FROM specialties s
      JOIN doctor_specialties ds ON ds.specialty_id = s.id
      JOIN doctors d ON d.id = ds.doctor_id AND d.active
     WHERE s.active
     GROUP BY s.slug
     ORDER BY doctor_count DESC, s.slug
  `);
  return res.rows;
}

type HospitalRow = Covered & { hospital_slug: string };

// hospital -> thana -> district, AND hospital -> doctor. Priority 2 after
// doctors, so this chain is enforced just as strictly.
async function fetchCoveredHospitals(): Promise<HospitalRow[]> {
  const res = await db.execute<HospitalRow>(sql`
    SELECT h.slug AS hospital_slug,
           COUNT(DISTINCT d.id)::int AS doctor_count,
           GREATEST(MAX(d.updated_at), MAX(h.updated_at)) AS updated_at
      FROM hospitals h
      JOIN doctors d ON d.hospital_id = h.id AND d.active
      JOIN areas a ON a.id = h.area_id AND a.active
      JOIN districts dist ON dist.id = a.district_id AND dist.active
     WHERE h.active
     GROUP BY h.slug
     ORDER BY doctor_count DESC, h.slug
  `);
  return res.rows;
}

// ---------------------------------------------------------------------------
// listSitemaps — the master list used by the index route AND robots.ts.
// Uses live DB counts to decide how many shards a section needs.
// ---------------------------------------------------------------------------

export async function listSitemaps(): Promise<ShardId[]> {
  const ids: ShardId[] = [];

  try {
    // Shard counts come from sectionEntries() — the exact same function the
    // shard route serialises. Counting any other way (e.g. specialties ×
    // areas) over-reports, the index then advertises shards that resolve to
    // an empty urlset, and the shard route 404s every one of them.
    //
    // Emitted in SECTION_ORDER, so the index itself carries the crawl
    // priority: doctors before hospitals before everything else.
    const sizes = await Promise.all(SECTION_ORDER.map((s) => sectionEntries(s).then((e) => e.length)));
    SECTION_ORDER.forEach((section, i) => {
      for (let p = 0; p < shardCount(sizes[i]); p++) ids.push({ section, page: p });
    });
  } catch {
    // DB unreachable during first build: fall back to only the core shard so
    // the site still boots and Google gets at least the static routes.
    return [{ section: "core", page: 0 }];
  }

  return ids.length > 0 ? ids : [{ section: "core", page: 0 }];
}

// ---------------------------------------------------------------------------
// sectionEntries — every URL a section owns, already stripped of paths that
// would redirect. buildShard() just pages this; listSitemaps() just counts it.
// ---------------------------------------------------------------------------

// Live redirect sources. A slug that was renamed and later renamed BACK leaves
// a stale `redirects` row behind: the entity is active and its page renders,
// but middleware 308s the URL away. Advertising such a URL costs crawl budget
// and lands it in GSC's "Page with redirect" bucket instead of the index — so
// every candidate path is checked against this set before it ships.
async function redirectSources(): Promise<Set<string>> {
  try {
    const rows = await db.select({ from: redirects.fromPath }).from(redirects);
    return new Set(rows.map((r) => r.from));
  } catch {
    return new Set();
  }
}

// bn URLs are unprefixed and en URLs carry /en — reduce either back to the
// locale-neutral path the redirect map is keyed on (mirrors middleware.ts).
function neutralPath(url: string): string {
  const { pathname } = new URL(url);
  if (pathname === "/en") return "/";
  return pathname.startsWith("/en/") ? pathname.slice(3) : pathname;
}

// Slugs the PAGES can actually resolve. These readers are unstable_cache-backed;
// the sitemap queries the DB directly. When rows are inserted outside a server
// action — a seed script, a manual SQL insert — no revalidateTag() fires, so the
// cache keeps serving the old list while the DB has more. The sitemap then
// advertises a slug whose page renders a soft 404. Intersecting with the cached
// readers keeps the two in lockstep: a new row enters the sitemap on the same
// revalidation that makes its page work.
//
// Slug-ONLY readers, deliberately. This used to call getSpecialties() and
// getAreas(), which return every SEO field for all 619 areas — about 1 MB pulled
// across the wire to build a Set of strings, and pulled once per sitemap section.
// Same cache tags as before, so the lockstep guarantee above is unchanged.
async function resolvableSlugs(): Promise<{ specialties: Set<string>; areas: Set<string> }> {
  const [specs, areas] = await Promise.all([getAllSpecialtySlugs(), getAllActiveAreaSlugs()]);
  return {
    specialties: new Set(specs),
    areas: new Set(areas),
  };
}

export async function sectionEntries(section: Section): Promise<SitemapEntry[]> {
  const raw = await collectSection(section);
  if (raw.length === 0) return raw;

  const sources = await redirectSources();
  return raw.filter((e) => !sources.has(neutralPath(e.url)));
}

// ---------------------------------------------------------------------------
// buildShard — resolve one section+page into the URL entries to serialise.
// ---------------------------------------------------------------------------

export async function buildShard({ section, page }: ShardId): Promise<SitemapEntry[]> {
  return shardSlice(await sectionEntries(section), page);
}

async function collectSection(section: Section): Promise<SitemapEntry[]> {
  const now = new Date();

  if (section === "core") {
    return [
      ...entry("/", now, "daily", 1.0),
      ...entry("/doctors", now, "daily", 0.9),
      ...entry("/specialties", now, "weekly", 0.8),
      // /areas and /districts (NOT /area) — these are the paths the navbar and
      // bottom nav link to, so they are the URLs Google treats as canonical.
      ...entry("/areas", now, "weekly", 0.8),
      ...entry("/districts", now, "weekly", 0.8),
      ...entry("/hospitals", now, "weekly", 0.7),
      ...entry("/blog", now, "weekly", 0.7),
      // /for-doctors is gone (308 -> /contact in next.config.ts), so it must
      // not be advertised: a sitemap entry that redirects lands in GSC's
      // "Page with redirect" bucket and burns crawl budget. /contact absorbed
      // its content, so it takes over the higher priority too.
      ...entry("/contact", now, "monthly", 0.6),
      ...entry("/about", now, "monthly", 0.5),
      ...entry("/privacy", now, "monthly", 0.3),
      ...entry("/terms", now, "monthly", 0.3),
    ];
  }

  try {
    // PRIORITY 1 — doctor profiles. The only section with no coverage chain:
    // a doctor profile is the content, so every active doctor ships. Freshest
    // first, so a partial crawl reaches new and just-edited doctors soonest.
    if (section === "doctors") {
      const rows = await db
        .select({ slug: doctorsT.slug, updated_at: doctorsT.updatedAt })
        .from(doctorsT)
        .where(eq(doctorsT.active, true))
        .orderBy(desc(doctorsT.updatedAt), asc(doctorsT.slug));
      return rows.flatMap((d) =>
        entry(`/doctors/${d.slug}`, d.updated_at, "weekly", BASE_PRIORITY.doctors),
      );
    }

    // PRIORITY 2 — hospitals. Chain: hospital -> thana -> district, and
    // hospital -> at least one active doctor.
    if (section === "hospitals") {
      const rows = await fetchCoveredHospitals();
      return rows.flatMap((h) =>
        entry(
          `/hospitals/${h.hospital_slug}`,
          h.updated_at ?? now,
          "weekly",
          coveragePriority("hospitals", h.doctor_count),
        ),
      );
    }

    if (section === "specialties") {
      const [rows, resolvable] = await Promise.all([fetchCoveredSpecialties(), resolvableSlugs()]);
      return rows.flatMap((s) =>
        resolvable.specialties.has(s.specialty_slug)
          ? entry(
              `/specialties/${s.specialty_slug}`,
              s.updated_at ?? now,
              "weekly",
              coveragePriority("specialties", s.doctor_count),
            )
          : [],
      );
    }

    if (section === "districts") {
      // Canonical district listing is /districts/<slug>/doctors — bare
      // /districts/<slug> is a 308 stub and must never be advertised.
      const rows = await fetchCoveredDistricts();
      return rows.flatMap((r) =>
        entry(
          `/districts/${r.district_slug}/doctors`,
          r.updated_at ?? now,
          "weekly",
          coveragePriority("districts", r.doctor_count),
        ),
      );
    }

    if (section === "areas") {
      const [rows, resolvable] = await Promise.all([fetchCoveredAreas(), resolvableSlugs()]);
      return rows.flatMap((a) =>
        resolvable.areas.has(a.area_slug)
          ? entry(
              `/area/doctors/${a.district_slug}/${a.area_slug}`,
              a.updated_at ?? now,
              "weekly",
              coveragePriority("areas", a.doctor_count),
            )
          : [],
      );
    }

    if (section === "specialty-area") {
      // Route is /specialties/[slug]/[area] — TWO segments. The district slug
      // does NOT belong here; emitting it produced 128 confirmed 404s in GSC.
      const [rows, resolvable] = await Promise.all([fetchSpecialtyAreaPairs(), resolvableSlugs()]);
      return rows.flatMap((r) =>
        resolvable.specialties.has(r.specialty_slug) && resolvable.areas.has(r.area_slug)
          ? entry(
              `/specialties/${r.specialty_slug}/${r.area_slug}`,
              r.updated_at ?? now,
              "weekly",
              coveragePriority("specialty-area", r.doctor_count),
            )
          : [],
      );
    }

    if (section === "blog") {
      const rows = await db
        .select({ slug: blogPosts.slug, updated_at: blogPosts.updatedAt })
        .from(blogPosts)
        .where(eq(blogPosts.published, true))
        .orderBy(desc(blogPosts.updatedAt), asc(blogPosts.slug));
      return rows.flatMap((p) => entry(`/blog/${p.slug}`, p.updated_at, "monthly", BASE_PRIORITY.blog));
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
