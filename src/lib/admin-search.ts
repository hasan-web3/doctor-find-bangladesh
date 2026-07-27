// Bilingual, typo-tolerant search predicate builder for the admin dashboards.
//
// Every callsite passes a raw user query and a list of SQL column expressions
// to search across. We build:
//   ILIKE %q%   — cheap partial/substring match, works for bn/en/mixed
//   word_similarity(q, col) > 0.4  — pg_trgm fuzzy match, catches typos
//                                    ("khalder" ≈ "khaleder"). Extension is
//                                    enabled by migration 003_fuzzy_search.sql.
//
// If the caller passes an empty/whitespace query we return `TRUE` so it can be
// unconditionally joined into a WHERE clause.

import { sql, type SQL } from "drizzle-orm";

export function searchClause(rawQuery: string | undefined | null, columns: SQL[]): SQL {
  const q = (rawQuery ?? "").trim();
  if (!q || columns.length === 0) return sql`TRUE`;
  const like = `%${q}%`;
  const parts: SQL[] = [];
  for (const col of columns) {
    parts.push(sql`${col} ILIKE ${like}`);
    parts.push(sql`word_similarity(${q}, ${col}) > 0.4`);
  }
  return sql`(${sql.join(parts, sql` OR `)})`;
}
