import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { searchClause } from "@/lib/admin-search";
import { getUnreadEntityIds, newFirstOrder } from "@/lib/notify";
import { getDistrictOptions } from "@/lib/admin-pickers";
import { AreasManager, type AreaRow } from "./manager";

export const dynamic = "force-dynamic";

type SP = { page?: string; perPage?: string; q?: string };

export default async function AdminAreasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Number(sp.perPage) || 30;
  const q = sp.q?.trim() || "";
  const searchCond: SQL = q
    ? searchClause(q, [sql`a.name->>'bn'`, sql`a.name->>'en'`, sql`a.slug`, sql`d.name->>'bn'`, sql`d.name->>'en'`])
    : sql`TRUE`;

  // Matters most here: 600+ thanas, so a newly added one would otherwise be
  // effectively invisible without knowing its name.
  const newFirst = newFirstOrder("a.id", await getUnreadEntityIds("areas"));

  // The district dropdown is tag-cached (src/lib/admin-pickers.ts); only the
  // page's own two queries run per load.
  const [areasRes, totalRes, districts] = await Promise.all([
    db.execute<AreaRow>(sql`
      SELECT a.id, a.slug, a.name, a.district_id,
        d.name->>'bn' AS district_bn,
        a.lat, a.lng, a.intro, a.meta_title, a.meta_description,
        a.active, a.sort,
        (SELECT COUNT(DISTINCT c.doctor_id)::int FROM chambers c WHERE c.area_id=a.id) AS doctor_count
      FROM areas a
      LEFT JOIN districts d ON d.id = a.district_id
      WHERE ${searchCond}
      ORDER BY ${newFirst} a.sort, a.id
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `),
    db.execute<{ c: number }>(sql`SELECT COUNT(*)::int AS c FROM areas a LEFT JOIN districts d ON d.id=a.district_id WHERE ${searchCond}`),
    getDistrictOptions(),
  ]);

  const totalCount = totalRes.rows[0]?.c ?? 0;
  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">থানা / উপজেলা</h1>
      <AreasManager
        rows={areasRes.rows}
        districts={districts}
        totalPages={totalPages}
        page={page}
        perPage={perPage}
        totalCount={totalCount}
        q={q}
      />
    </div>
  );
}
