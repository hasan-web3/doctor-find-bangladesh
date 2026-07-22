// Small typo-tolerant text matching helper used by every admin/frontend combobox.
// Not a full Elasticsearch — good enough that "khulna" finds "খুলনা" via English
// mirror, "khlna" (typo) still surfaces "khulna", and a partial substring wins
// over an approximate match.

const norm = (s: string) => s.toLowerCase().trim();

// Damerau–Levenshtein edit distance capped so we bail out early for long strings.
function editDistance(a: string, b: string, cap = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const m = a.length, n = b.length;
  // Two rolling rows — no need for the full matrix.
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Higher score = better match. Zero = no match, prune from the result set.
export function fuzzyScore(query: string, ...candidates: (string | null | undefined)[]): number {
  const q = norm(query);
  if (!q) return 1;
  let best = 0;
  for (const raw of candidates) {
    if (!raw) continue;
    const c = norm(raw);
    if (!c) continue;

    if (c === q) return 100;                                   // exact
    if (c.startsWith(q)) best = Math.max(best, 80);            // prefix
    if (c.includes(q)) best = Math.max(best, 60);              // substring

    // Word-start match ("kh" matches "Khulna Sadar" via the second token too).
    for (const word of c.split(/\s+/)) {
      if (word.startsWith(q)) { best = Math.max(best, 55); break; }
    }

    // Typo tolerance — 1 or 2 edits away for short queries only.
    if (q.length >= 3) {
      const dist = editDistance(q, c);
      if (dist === 1) best = Math.max(best, 40);
      else if (dist === 2 && q.length >= 5) best = Math.max(best, 25);
    }
  }
  return best;
}

// Rank + filter a list. Options with score 0 are dropped; ties preserve order.
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getStrings: (item: T) => (string | null | undefined)[]
): T[] {
  const q = query.trim();
  if (!q) return items;
  const scored = items
    .map((item, idx) => ({ item, idx, score: fuzzyScore(q, ...getStrings(item)) }))
    .filter((s) => s.score > 0);
  scored.sort((a, b) => (b.score - a.score) || (a.idx - b.idx));
  return scored.map((s) => s.item);
}
