import { sql } from "drizzle-orm";
import { db } from "@/db";
import { DistrictsManager, type DistrictRow } from "./manager";

export const dynamic = "force-dynamic";

export default async function AdminDistrictsPage() {
  const { rows } = await db.execute<DistrictRow>(sql`
    SELECT d.id, d.slug, d.name, d.lat, d.lng, d.intro, d.meta_title, d.meta_description,
      d.active, d.sort,
      (SELECT COUNT(*)::int FROM areas ar WHERE ar.district_id = d.id) AS area_count
    FROM districts d ORDER BY d.sort, d.id
  `);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">জেলা</h1>
      <p className="mb-5 mt-0 text-sm text-ink-faint">এলাকা তৈরি করার আগে সেই এলাকার জেলা থাকা দরকার। এখান থেকে জেলা যোগ, এডিট বা মুছে ফেলা যায়।</p>
      <DistrictsManager rows={rows} />
    </div>
  );
}
