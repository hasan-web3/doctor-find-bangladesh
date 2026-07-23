import { sql } from "drizzle-orm";
import { db } from "@/db";
import { DistrictsManager, type DistrictRow } from "./manager";

export const dynamic = "force-dynamic";

type SP = { page?: string; perPage?: string };

export default async function AdminDistrictsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Number(sp.perPage) || 30;

  const [districtsRes, totalRes] = await Promise.all([
    db.execute<DistrictRow>(sql`
    SELECT d.id, d.slug, d.name, d.lat, d.lng, d.intro, d.meta_title, d.meta_description,
      d.active, d.sort,
      (SELECT COUNT(*)::int FROM areas ar WHERE ar.district_id = d.id) AS area_count
    FROM districts d ORDER BY d.sort, d.id
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `),
    db.execute<{ c: number }>(sql`SELECT COUNT(*)::int AS c FROM districts`),
  ]);

  const totalCount = totalRes.rows[0]?.c ?? 0;
  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">জেলা</h1>
      <p className="mb-5 mt-0 text-sm text-ink-faint">এলাকা তৈরি করার আগে সেই এলাকার জেলা থাকা দরকার। এখান থেকে জেলা যোগ, এডিট বা মুছে ফেলা যায়।</p>
      <DistrictsManager
        rows={districtsRes.rows}
        totalPages={totalPages}
        page={page}
        perPage={perPage}
        totalCount={totalCount}
      />
    </div>
  );
}
