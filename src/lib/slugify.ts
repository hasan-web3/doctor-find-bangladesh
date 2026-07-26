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

// When `base` collides, walk `-2`, `-3`, … until one is free. Keeps URLs
// readable — only bumps a numeric suffix on real duplicates, never sprinkles
// a random timestamp. `isTaken` MUST already exclude the current row's id.
export async function nextAvailableSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString().slice(-4)}`;
}
