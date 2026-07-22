import { sql } from "drizzle-orm";
import { db } from "@/db";
import { SpecialtiesManager, type SpecialtyRow } from "./manager";

export const dynamic = "force-dynamic";

export default async function AdminSpecialtiesPage() {
  const { rows } = await db.execute<SpecialtyRow>(sql`
    SELECT s.id, s.slug, s.name, s.icon, s.tint, s.intro, s.meta_title, s.meta_description,
      s.active, s.sort,
      (SELECT COUNT(*)::int FROM doctor_specialties ds WHERE ds.specialty_id=s.id) AS doctor_count
    FROM specialties s ORDER BY s.sort, s.id
  `);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">বিশেষজ্ঞ বিভাগ</h1>
      <SpecialtiesManager rows={rows} />
    </div>
  );
}
