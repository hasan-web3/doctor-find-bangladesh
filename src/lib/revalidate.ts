import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";

// Every dashboard mutation calls this so public pages update instantly.
// Tags cover cached data readers; layout-level path revalidation refreshes
// all rendered routes that consumed them.
export function revalidatePublic(tags: string[] = []) {
  for (const tag of tags) revalidateTag(tag);
  revalidateTag("sitemap");
  revalidatePath("/", "layout");
}

// Bilingual path helper: every public route ships at `/x` (bn) and `/en/x`.
function bothLocales(path: string): string[] {
  const p = path.startsWith("/") ? path : `/${path}`;
  return [p, `/en${p === "/" ? "" : p}`];
}

// Doctor-specific revalidation. Called by every mutation surface that touches
// a doctor row (create / update / delete / bulk delete). Broad tag/layout
// revalidation is still fired via revalidatePublic, but individual paths are
// listed here so Vercel's edge URL cache flips instantly for the exact pages
// a visitor might have bookmarked — especially the slug detail page.
//
// Pass `oldSlug` on updates when the slug changed, so the previous URL is
// also purged (otherwise the old URL keeps serving a stale 200 until TTL).
export function revalidateDoctor(opts: {
  slug?: string | null;
  oldSlug?: string | null;
  specialtySlug?: string | null;
  areaSlug?: string | null;
  districtSlug?: string | null;
  hospitalSlug?: string | null;
} = {}) {
  revalidatePublic(["doctors", "specialties", "areas", "hospitals"]);

  // Listing pages that always show doctors.
  for (const p of ["/doctors", "/", "/for-doctors"]) {
    for (const url of bothLocales(p)) revalidatePath(url);
  }

  // Detail pages — current and (if renamed) previous slug.
  const slugs = new Set<string>();
  if (opts.slug) slugs.add(opts.slug);
  if (opts.oldSlug && opts.oldSlug !== opts.slug) slugs.add(opts.oldSlug);
  for (const s of slugs) {
    for (const url of bothLocales(`/doctors/${s}`)) revalidatePath(url);
    for (const url of bothLocales(`/appointment/${s}`)) revalidatePath(url);
  }

  // Related landing pages that list this doctor.
  if (opts.specialtySlug) {
    for (const url of bothLocales(`/specialties/${opts.specialtySlug}`)) revalidatePath(url);
  }
  if (opts.districtSlug && opts.areaSlug) {
    for (const url of bothLocales(`/area/doctors/${opts.districtSlug}/${opts.areaSlug}`)) revalidatePath(url);
  }
  if (opts.hospitalSlug) {
    for (const url of bothLocales(`/hospitals/${opts.hospitalSlug}`)) revalidatePath(url);
  }

  // Sitemap index + doctors shard so search engines re-crawl fresh URLs.
  revalidatePath("/sitemap.xml");
  revalidatePath("/sitemap/doctors.xml");
  revalidatePath("/sitemap/core.xml");
}
