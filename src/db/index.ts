// Drizzle client + legacy raw helpers.
// `db` is the Drizzle instance (use it for all new code).
// `query` / `queryOne` remain for a small number of raw-SQL escape hatches
// (generated columns, tsvector search, dynamic pivot queries) that Drizzle
// doesn't express as cleanly.

import { Pool, types } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Return BIGINT / NUMERIC as JS numbers (our ids fit inside Number.MAX_SAFE_INTEGER).
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __drizzle: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new Pool({
    connectionString: url,
    max: 10,
    ssl:
      url.includes("localhost") || url.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
  });
}

export function getPool(): Pool {
  if (!global.__dbPool) global.__dbPool = createPool();
  return global.__dbPool;
}

export function getDb() {
  if (!global.__drizzle) global.__drizzle = drizzle(getPool(), { schema });
  return global.__drizzle;
}

// Convenience: `db` is a getter-proxy so `import { db } from "@/db"` works
// without ever touching the pool at module load time.
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export { schema };
export * from "./schema";

// ---------- legacy raw helpers (escape hatch) ----------
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await getPool().query(text, params as never[]);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
