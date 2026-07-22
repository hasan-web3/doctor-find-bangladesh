// Compatibility shim: legacy imports (`@/lib/db`) still resolve, but the real
// client lives in `@/db`. Prefer `import { db } from "@/db"` for new code.
export { db, getDb, getPool, query, queryOne } from "@/db";
