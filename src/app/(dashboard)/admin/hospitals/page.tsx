import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { searchClause } from "@/lib/admin-search";
import { getUnreadEntityIds, newFirstOrder } from "@/lib/notify";
import { getAreaOptions, getSpecialtyOptions, getDistrictOptions } from "@/lib/admin-pickers";
import { HospitalsManager, type HospitalRow } from "./manager";

export const dynamic = "force-dynamic";

type SP = { page?: string; perPage?: string; q?: string };

export default async function AdminHospitalsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Number(sp.perPage) || 30;
  const q = sp.q?.trim() || "";
  const searchCond: SQL = q
    ? searchClause(q, [sql`h.name->>'bn'`, sql`h.name->>'en'`, sql`h.slug`, sql`h.address->>'bn'`, sql`h.address->>'en'`, sql`h.phone`])
    : sql`TRUE`;

  // Unopened new rows lead the list.
  const newFirst = newFirstOrder("h.id", await getUnreadEntityIds("hospitals"));

  // The three dropdown lists are tag-cached (src/lib/admin-pickers.ts); only
  // the page's own two queries run per load.
  const [hospitalsRes, totalRes, areas, specialties, districts] = await Promise.all([
    db.execute<HospitalRow>(sql`
      SELECT h.id, h.slug, h.name, h.area_id, a.name->>'bn' AS area_bn, a.district_id AS area_district_id,
        h.address, h.phone, h.lat, h.lng, h.description, h.departments, h.map_url,
        h.image_url, h.gallery, h.meta_title, h.meta_description, h.active
      FROM hospitals h LEFT JOIN areas a ON a.id=h.area_id
      WHERE ${searchCond}
      ORDER BY ${newFirst} h.sort, h.id
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `),
    db.execute<{ c: number }>(sql`SELECT COUNT(*)::int AS c FROM hospitals h WHERE ${searchCond}`),
    // Areas carry district_id + district labels so the client can filter thanas by chosen district.
    getAreaOptions(),
    getSpecialtyOptions(),
    getDistrictOptions(),
  ]);

  const totalPages = Math.ceil((totalRes.rows[0]?.c ?? 0) / perPage);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">হাসপাতাল ও ক্লিনিক / Hospitals & Clinics</h1>
      <HospitalsManager
        rows={hospitalsRes.rows}
        areas={areas}
        specialties={specialties}
        districts={districts}
        totalPages={totalPages}
        page={page}
        perPage={perPage}
        q={q}
      />
    </div>
  );
}
