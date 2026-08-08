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
  doctors: ["/", "/doctors", "/for-doctors", "/specialties", "/areas", "/hospitals", "/districts"],
  hospitals: ["/", "/hospitals"],
  specialties: ["/", "/specialties"],
  areas: ["/", "/areas", "/area"],
  districts: ["/", "/districts", "/areas"],
  blog: ["/blog"],
  reviews: ["/", "/doctors"],
  slides: ["/"],
  faqs: ["/"],
  testimonials: ["/"],
  "static-pages": ["/about", "/privacy", "/terms", "/for-doctors", "/contact"],
  redirects: [],
};

// Tags whose data is stitched into the shared layout (brand name, helpline,
// logos, analytics snippets, per-URL SEO overrides). These genuinely do affect
// every rendered page, so a layout-wide purge is the correct response — and
// they are rare, deliberate admin actions rather than routine content edits.
const LAYOUT_WIDE_TAGS = new Set(["settings", "integrations", "seo"]);

// Purge the sitemap index AND every shard. The shards are one dynamic route
// (/sitemap/[shard]), so a single "page"-scoped call covers all of them.
//
// This has to run on EVERY content mutation, not just doctor edits: one new
// doctor can create URLs in five different sections at once (their profile,
// their hospital, their specialty hub, their thana, their district), so
// revalidating a hand-picked subset of shards would leave the rest stale.
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

export function revalidatePublic(tags: string[] = []) {
  for (const tag of tags) revalidateTag(tag);
  if (tags.includes("redirects")) revalidatePath("/api/redirects");
  revalidateTag("sitemap");
  revalidateSitemaps();

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

export function revalidateDoctor(opts: {
  slug?: string | null;
  oldSlug?: string | null;
  specialtySlug?: string | null;
  areaSlug?: string | null;
  districtSlug?: string | null;
  hospitalSlug?: string | null;
} = {}) {
  // Only the "doctors" tag. Adding "specialties"/"areas" here is what made a
  // single doctor edit purge the entire site: both are read by the shared
  // layout, so revalidating them invalidates every cached page. The hubs those
  // tags used to refresh are covered by TAG_PATHS["doctors"] instead.
  revalidatePublic(["doctors"]);

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

  // Sitemaps are already purged wholesale by revalidatePublic() above — a
  // doctor change can ripple into any section, so no per-shard list here.
}

export function revalidateHospital(opts: { slug?: string | null; oldSlug?: string | null } = {}) {
  // "hospitals" and "doctors" are both safe: neither is read by the shared
  // layout, so neither cascades site-wide.
  revalidatePublic(["hospitals", "doctors"]);
  for (const s of slugSet(opts.slug, opts.oldSlug)) revalidateBoth([`/hospitals/${s}`]);
}

export function revalidateBlogPost(opts: { slug?: string | null; oldSlug?: string | null } = {}) {
  revalidatePublic(["blog"]);
  for (const s of slugSet(opts.slug, opts.oldSlug)) revalidateBoth([`/blog/${s}`]);
}

export function revalidateSpecialty(opts: { slug?: string | null; oldSlug?: string | null } = {}) {
  revalidatePublic(["specialties", "doctors"]);
  for (const s of slugSet(opts.slug, opts.oldSlug)) revalidateBoth([`/specialties/${s}`]);
}

export function revalidateArea(opts: {
  slug?: string | null;
  oldSlug?: string | null;
  districtSlug?: string | null;
} = {}) {
  revalidatePublic(["areas", "districts", "doctors"]);
  if (!opts.districtSlug) return;
  for (const s of slugSet(opts.slug, opts.oldSlug)) {
    revalidateBoth([`/area/doctors/${opts.districtSlug}/${s}`]);
  }
}

export function revalidateDistrict(opts: { slug?: string | null; oldSlug?: string | null } = {}) {
  revalidatePublic(["districts", "areas", "doctors"]);
  for (const s of slugSet(opts.slug, opts.oldSlug)) {
    revalidateBoth([`/districts/${s}/doctors`]);
  }
}
