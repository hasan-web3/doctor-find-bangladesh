import { sql } from "drizzle-orm";
import { db } from "@/db";
import { AreasManager, type AreaRow } from "./manager";

export const dynamic = "force-dynamic";

export default async function AdminAreasPage() {
  const [areasRes, districtsRes] = await Promise.all([
    db.execute<AreaRow>(sql`
      SELECT a.id, a.slug, a.name, a.district_id,
        d.name->>'bn' AS district_bn,
        a.lat, a.lng, a.intro, a.meta_title, a.meta_description,
        a.active, a.sort,
        (SELECT COUNT(DISTINCT c.doctor_id)::int FROM chambers c WHERE c.area_id=a.id) AS doctor_count
      FROM areas a
      LEFT JOIN districts d ON d.id = a.district_id
      ORDER BY a.sort, a.id
    `),
    db.execute<{ id: number; name_bn: string; name_en: string | null }>(sql`
      SELECT id, name->>'bn' AS name_bn, name->>'en' AS name_en FROM districts WHERE active ORDER BY sort, id
    `),
  ]);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">থানা / উপজেলা</h1>
      <AreasManager rows={areasRes.rows} districts={districtsRes.rows} />
    </div>
  );
}
