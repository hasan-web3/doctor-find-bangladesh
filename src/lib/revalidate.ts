import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

// Every dashboard mutation calls into this module so public pages update
// instantly instead of waiting out their ISR window.
//
// ---------------------------------------------------------------------------
// Why this is no longer a blanket purge
// ---------------------------------------------------------------------------
// This used to end with `revalidatePath("/", "layout")`, which invalidates
// EVERY cached page on the site. That was harmless while nothing was cached —
// all 24 public routes were `ƒ Dynamic`. Now that they are ISR, a blanket purge
// on every mutation would mean one FAQ reorder throws away the entire site
// cache and the next crawl re-renders thousands of doctor pages from scratch.
// That single line could have cost more CPU than the whole ISR migration saves.
//
// So invalidation is now driven by the tag each mutation already declares.
// Tags cover the `unstable_cache` readers; the path lists below cover the
// rendered pages that consume them.

// Bilingual path helper.
//
// Bangla is SERVED at `/x` but RENDERED at `/bn/x` — the middleware rewrites
// the root URL into the `[locale]` segment, so the cache entry is keyed
// `/bn/x`. revalidatePath() matches the rendered path, not the public one, so
// passing `/x` here silently matched nothing and the Bangla half of every
// per-path purge was a no-op. (It went unnoticed because the old
// `revalidatePath("/", "layout")` invalidated everything anyway.)
//
// Verified against a production build: `revalidatePath("/specialties")` left
// `/specialties` a cache HIT, `revalidatePath("/bn/specialties")` turned it to
// MISS.
function bothLocales(path: string): string[] {
  const p = path.startsWith("/") ? path : `/${path}`;
  const suffix = p === "/" ? "" : p;
  return [`/bn${suffix}`, `/en${suffix}`];
}

function revalidateBoth(paths: string[]) {
  for (const p of paths) for (const url of bothLocales(p)) revalidatePath(url);
}

// Which rendered pages each cache tag can change.
//
// Per-entity detail pages are NOT here — they are purged by slug in the
// entity-specific helpers below, because only the caller knows which slug moved.
const TAG_PATHS: Record<string, string[]> = {
  // A doctor edit changes the doctor counts and orderings shown on the
  // specialty / area / hospital hubs too. Those are listed as PATHS rather than
  // reached by also passing the "specialties"/"areas" tags, because those two
  // tags are read by the shared layout (footer specialty links, district
  // picker) and so would cascade into every page on the site. Paths are exact;
  // tags are transitive.
  doctors: ["/", "/doctors", "/specialties", "/areas", "/hospitals", "/districts"],
  hospitals: ["/", "/hospitals"],
  specialties: ["/", "/specialties"],
  areas: ["/", "/areas", "/area"],
  districts: ["/", "/districts", "/areas"],
  blog: ["/blog"],
  reviews: ["/", "/doctors"],
  slides: ["/"],
  faqs: ["/"],
  testimonials: ["/"],
  "static-pages": ["/about", "/privacy", "/terms", "/contact"],
  redirects: [],
};

// Tags whose data is stitched into the shared layout (brand name, helpline,
// logos, analytics snippets, per-URL SEO overrides). These genuinely do affect
// every rendered page, so a layout-wide purge is the correct response — and
// they are rare, deliberate admin actions rather than routine content edits.
const LAYOUT_WIDE_TAGS = new Set(["settings", "integrations", "seo"]);

// Tags whose data can actually appear in the sitemap.
//
// The sitemap is built entirely from ENTITIES (their slug, and their updated_at
// as <lastmod>) plus the redirect table — see src/lib/sitemap-core.ts. Nothing
// in it reads a slide, a FAQ, a testimonial, a review, the site settings, an
// integration or a per-URL SEO override, so a mutation carrying only those tags
// cannot change a single <loc> or <lastmod>.
//
// It used to be rebuilt for all of them anyway: revalidatePublic() called
// revalidateSitemaps() unconditionally, so reordering one FAQ threw away the
// index AND every shard, and the next crawl re-ran the section queries (8 000
// URLs per shard, four hreflang alternates each) to produce a byte-identical
// file. That is the single most expensive purge in the app and most callers
// never needed it.
//
// `sitemap` itself is in this set on purpose: the admin's manual "refresh
// sitemap" button (regenerateSitemap in src/actions/admin-system.ts) passes
// exactly that tag and nothing else, and it must keep working.
const SITEMAP_TAGS = new Set([
  "sitemap",
  "doctors",
  "hospitals",
  "blog",
  "specialties",
  "districts",
  "areas",
  "redirects",
  "static-pages",
]);

// Shared shape for every purge helper below.
export type PurgeOptions = {
  /**
   * Force the sitemap purge ON or OFF.
   *
   * Omit it and the tags decide (see SITEMAP_TAGS), which is right for almost
   * every caller. Pass `false` when the mutation demonstrably cannot move a
   * URL or a lastmod — approving a review, editing a doctor without renaming
   * them — so the shards keep serving from cache until their own 24 h window
   * (`revalidate = 86400` in src/app/sitemap/[shard]/route.ts) rolls them over.
   * The cost of being wrong is a lastmod up to a day stale, which is well
   * inside what crawlers expect.
   */
  sitemap?: boolean;
};

// Purge the sitemap index AND every shard. The shards are one dynamic route
// (/sitemap/[shard]), so a single "page"-scoped call covers all of them.
//
// It is all-or-nothing on purpose: one new doctor can create URLs in five
// different sections at once (their profile, their hospital, their specialty
// hub, their thana, their district), so revalidating a hand-picked subset of
// shards would leave the rest stale.
//
// Because it is all-or-nothing it is also the most expensive purge in the app,
// which is why revalidatePublic() no longer calls it unconditionally — see
// SITEMAP_TAGS and PurgeOptions above for when it does.
export function revalidateSitemaps() {
  revalidatePath("/sitemap.xml");
  revalidatePath("/sitemap/[shard]", "page");
}

// The middleware's redirect snapshot is refreshed from /api/redirects, and that
// route is now response-cached for a long window (see the note there) so bot and
// visitor traffic never wakes a function for it. That trade only works if the
// cache is purged the moment a redirect actually changes — which is what this
// does. The `redirects` TAG alone is not enough: it clears the inner
// unstable_cache read, not the cached HTTP response in front of it.
export function revalidateRedirects() {
  revalidateTag("redirects");
  revalidatePath("/api/redirects");
}

// /favicon.ico proxies the admin-uploaded icon out of R2 through our own
// origin. That route is ISR-cached with a ONE DAY ceiling (see the note there),
// which is only correct because this runs the moment the icon can actually
// change — i.e. on any settings save. Without it an admin would upload a new
// favicon and watch the old one persist for up to a day.
//
// A path purge, not just a tag: the `settings` tag clears the inner
// unstable_cache read, but the cached HTTP RESPONSE in front of it is keyed by
// path. Same distinction as revalidateRedirects() above.
export function revalidateFavicon() {
  revalidatePath("/favicon.ico");
}

// A connection test writes only `status` / `status_message` / `last_tested_at`,
// and those are read exclusively by /admin/integrations. Routing it through
// revalidatePublic() would hit the layout-wide "integrations" tag and throw away
// the whole site cache just to refresh a status badge — the exact blanket purge
// the note at the top of this file exists to prevent. So the tag is cleared on
// its own: enough for the admin page's cached reader, invisible to public ISR.
export function revalidateIntegrationStatus() {
  revalidateTag("integrations");
}

export function revalidatePublic(tags: string[] = [], opts: PurgeOptions = {}) {
  for (const tag of tags) revalidateTag(tag);
  if (tags.includes("redirects")) revalidatePath("/api/redirects");
  // The favicon lives behind its own cached route, so the layout-wide purge
  // below does not reach it — route handlers are not part of a layout tree.
  if (tags.includes("settings")) revalidateFavicon();

  // Explicit wins; otherwise the tags decide. See SITEMAP_TAGS.
  const touchesSitemap = opts.sitemap ?? tags.some((t) => SITEMAP_TAGS.has(t));
  if (touchesSitemap) {
    revalidateTag("sitemap");
    revalidateSitemaps();
  }

  // A tag that reaches the layout invalidates everything; nothing else does.
  if (tags.some((t) => LAYOUT_WIDE_TAGS.has(t))) {
    revalidatePath("/", "layout");
    return;
  }

  const paths = new Set<string>();
  for (const tag of tags) for (const p of TAG_PATHS[tag] ?? []) paths.add(p);
  // A mutation with no recognised tag still refreshes the homepage: it is the
  // one page that surfaces almost every content type, and it is cheap.
  if (paths.size === 0) paths.add("/");
  revalidateBoth([...paths]);
}

// ---------------------------------------------------------------------------
// entity-specific helpers
// ---------------------------------------------------------------------------
// Each one purges the shared hubs (via revalidatePublic) plus the exact detail
// URLs the mutation touched. Pass `oldSlug` on updates when the slug changed,
// so the previous URL is purged too — otherwise it keeps serving a stale 200
// until its ISR window expires.

function slugSet(slug?: string | null, oldSlug?: string | null): string[] {
  const out = new Set<string>();
  if (slug) out.add(slug);
  if (oldSlug && oldSlug !== slug) out.add(oldSlug);
  return [...out];
}

export type DoctorPurge = {
  slug?: string | null;
  oldSlug?: string | null;
  specialtySlug?: string | null;
  areaSlug?: string | null;
  districtSlug?: string | null;
  hospitalSlug?: string | null;
};

// The PER-DOCTOR half: the exact detail URLs this one doctor owns, plus the
// landing pages they appear on. Cheap, and different for every doctor.
//
// ---------------------------------------------------------------------------
// KNOWN GAP — read this before lengthening any listing page's `revalidate`
// ---------------------------------------------------------------------------
// Every field below except `slug`/`oldSlug` is optional, and the doctor
// mutations in src/actions/admin-doctors.ts do not currently pass them: both
// saveDoctor() and deleteDoctor() call revalidateDoctor({ slug, oldSlug,
// sitemap }) and nothing more. So in practice a doctor edit purges
// /doctors/<slug> and /appointment/<slug>, and the LISTING pages that show
// that doctor are not purged at all:
//
//   /specialties/<spec>            /specialties/<spec>/<area>
//   /districts/<dist>/doctors      /districts/<dist>/<spec>
//   /area/doctors/<dist>/<area>    /hospitals/<hosp>
//
// Those pages are kept honest by their own 24 h ISR window instead. That is
// why they were deliberately LEFT at `revalidate = 86400` when the detail
// routes moved to 7 days: for them the timer is not redundant, it is the only
// mechanism that makes a newly added doctor appear on their district's or
// specialty's landing page. Raise those numbers and a new doctor can stay
// invisible on their own area page for a week.
//
// The proper fix is to resolve the doctor's specialty / district / area /
// hospital slugs at the mutation site and pass them here, at which point the
// purge becomes complete and those windows can be lengthened too. Until then,
// leave them alone.
function revalidateDoctorPaths(opts: DoctorPurge) {
  for (const s of slugSet(opts.slug, opts.oldSlug)) {
    revalidateBoth([`/doctors/${s}`, `/appointment/${s}`]);
  }

  // Landing pages that list this doctor.
  if (opts.specialtySlug) revalidateBoth([`/specialties/${opts.specialtySlug}`]);
  if (opts.districtSlug) revalidateBoth([`/districts/${opts.districtSlug}/doctors`]);
  if (opts.districtSlug && opts.areaSlug) {
    revalidateBoth([`/area/doctors/${opts.districtSlug}/${opts.areaSlug}`]);
  }
  if (opts.specialtySlug && opts.areaSlug) {
    revalidateBoth([`/specialties/${opts.specialtySlug}/${opts.areaSlug}`]);
  }
  if (opts.hospitalSlug) revalidateBoth([`/hospitals/${opts.hospitalSlug}`]);
}

// The SHARED half: the "doctors" tag and the hub pages every doctor has in
// common, plus (conditionally) the sitemap. Identical no matter which doctor
// moved, so a bulk operation must run it exactly ONCE — see revalidateDoctors.
//
// Only the "doctors" tag. Adding "specialties"/"areas" here is what made a
// single doctor edit purge the entire site: both are read by the shared
// layout, so revalidating them invalidates every cached page. The hubs those
// tags used to refresh are covered by TAG_PATHS["doctors"] instead.
function revalidateDoctorShared(opts: PurgeOptions) {
  revalidatePublic(["doctors"], opts);
}

/**
 * One doctor changed.
 *
 * Pass `sitemap: false` for an edit that cannot move a URL — no rename, no
 * activate/deactivate, not a create or a delete. The doctor's own <lastmod>
 * then refreshes on the shard's normal 24 h window instead of rebuilding every
 * shard on the site for a changed phone number.
 */
export function revalidateDoctor(opts: DoctorPurge & PurgeOptions = {}) {
  revalidateDoctorShared(opts);
  revalidateDoctorPaths(opts);
}

/**
 * Many doctors changed in one admin action (bulk delete, bulk toggle).
 *
 * The point of this over a `for` loop around revalidateDoctor(): the shared
 * half runs once instead of N times. Deleting 50 doctors used to fire 50
 * `revalidateTag("doctors")` calls, 50 full sitemap purges and 600 hub
 * revalidatePath() calls to accomplish what one of each does.
 */
export function revalidateDoctors(entries: DoctorPurge[], opts: PurgeOptions = {}) {
  if (entries.length === 0) return;
  revalidateDoctorShared(opts);
  for (const entry of entries) revalidateDoctorPaths(entry);
}

export function revalidateHospital(
  opts: { slug?: string | null; oldSlug?: string | null } & PurgeOptions = {}
) {
  // "hospitals" and "doctors" are both safe: neither is read by the shared
  // layout, so neither cascades site-wide.
  revalidatePublic(["hospitals", "doctors"], opts);
  for (const s of slugSet(opts.slug, opts.oldSlug)) revalidateBoth([`/hospitals/${s}`]);
}

export function revalidateBlogPost(
  opts: { slug?: string | null; oldSlug?: string | null } & PurgeOptions = {}
) {
  revalidatePublic(["blog"], opts);
  for (const s of slugSet(opts.slug, opts.oldSlug)) revalidateBoth([`/blog/${s}`]);
}

export function revalidateSpecialty(
  opts: { slug?: string | null; oldSlug?: string | null } & PurgeOptions = {}
) {
  revalidatePublic(["specialties", "doctors"], opts);
  for (const s of slugSet(opts.slug, opts.oldSlug)) revalidateBoth([`/specialties/${s}`]);
}

export function revalidateArea(
  opts: {
    slug?: string | null;
    oldSlug?: string | null;
    districtSlug?: string | null;
  } & PurgeOptions = {}
) {
  revalidatePublic(["areas", "districts", "doctors"], opts);
  if (!opts.districtSlug) return;
  for (const s of slugSet(opts.slug, opts.oldSlug)) {
    revalidateBoth([`/area/doctors/${opts.districtSlug}/${s}`]);
  }
}

export function revalidateDistrict(
  opts: { slug?: string | null; oldSlug?: string | null } & PurgeOptions = {}
) {
  revalidatePublic(["districts", "areas", "doctors"], opts);
  for (const s of slugSet(opts.slug, opts.oldSlug)) {
    revalidateBoth([`/districts/${s}/doctors`]);
  }
}
