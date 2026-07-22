// URL slug helper. Keeps ASCII slugs for clean programmatic-SEO URLs
// (e.g. /specialties/neurology/khalishpur) while all content stays Bangla.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['".,()]/g, "")
    .replace(/[^a-z0-9ঀ-৿]+/g, "-") // keep Bangla letters if used
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `item-${Date.now()}`;
}
