import { sql } from "drizzle-orm";
import { db } from "@/db";
import { AreasManager, type AreaRow } from "./manager";

export const dynamic = "force-dynamic";

type SP = { page?: string; perPage?: string };

export default async function AdminAreasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Number(sp.perPage) || 30;

  const [areasRes, totalRes, districtsRes] = await Promise.all([
    db.execute<AreaRow>(sql`
      SELECT a.id, a.slug, a.name, a.district_id,
        d.name->>'bn' AS district_bn,
        a.lat, a.lng, a.intro, a.meta_title, a.meta_description,
        a.active, a.sort,
        (SELECT COUNT(DISTINCT c.doctor_id)::int FROM chambers c WHERE c.area_id=a.id) AS doctor_count
      FROM areas a
      LEFT JOIN districts d ON d.id = a.district_id
      ORDER BY a.sort, a.id
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `),
    db.execute<{ c: number }>(sql`SELECT COUNT(*)::int AS c FROM areas`),
    db.execute<{ id: number; name_bn: string; name_en: string | null }>(sql`
      SELECT id, name->>'bn' AS name_bn, name->>'en' AS name_en FROM districts WHERE active ORDER BY sort, id
    `),
  ]);

  const totalCount = totalRes.rows[0]?.c ?? 0;
  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">থানা / উপজেলা</h1>
      <AreasManager
        rows={areasRes.rows}
        districts={districtsRes.rows}
        totalPages={totalPages}
        page={page}
        perPage={perPage}
        totalCount={totalCount}
      />
    </div>
  );
}
