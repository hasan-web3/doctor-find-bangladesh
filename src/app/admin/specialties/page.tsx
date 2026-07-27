import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { searchClause } from "@/lib/admin-search";
import { SpecialtiesManager, type SpecialtyRow } from "./manager";

export const dynamic = "force-dynamic";

type SP = { page?: string; perPage?: string; q?: string };

export default async function AdminSpecialtiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Number(sp.perPage) || 30;
  const q = sp.q?.trim() || "";
  const searchCond: SQL = q
    ? searchClause(q, [sql`s.name->>'bn'`, sql`s.name->>'en'`, sql`s.slug`])
    : sql`TRUE`;

  const [specialtiesRes, totalRes] = await Promise.all([
    db.execute<SpecialtyRow>(sql`
    SELECT s.id, s.slug, s.name, s.icon, s.tint, s.intro, s.meta_title, s.meta_description,
      s.active, s.sort,
      (SELECT COUNT(*)::int FROM doctor_specialties ds WHERE ds.specialty_id=s.id) AS doctor_count
    FROM specialties s WHERE ${searchCond} ORDER BY s.sort, s.id
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `),
    db.execute<{ c: number }>(sql`SELECT COUNT(*)::int AS c FROM specialties s WHERE ${searchCond}`),
  ]);

  const totalCount = totalRes.rows[0]?.c ?? 0;
  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">বিশেষজ্ঞ বিভাগ</h1>
      <SpecialtiesManager
        rows={specialtiesRes.rows}
        totalPages={totalPages}
        page={page}
        perPage={perPage}
        totalCount={totalCount}
        q={q}
      />
    </div>
  );
}
