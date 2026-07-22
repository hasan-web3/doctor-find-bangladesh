import { sql } from "drizzle-orm";
import { db } from "@/db";
import { HospitalsManager, type HospitalRow } from "./manager";

export const dynamic = "force-dynamic";

export default async function AdminHospitalsPage() {
  const [hospitalsRes, areasRes, specialtiesRes, districtsRes] = await Promise.all([
    db.execute<HospitalRow>(sql`
      SELECT h.id, h.slug, h.name, h.area_id, a.name->>'bn' AS area_bn, a.district_id AS area_district_id,
        h.address, h.phone, h.lat, h.lng, h.description, h.departments, h.map_url,
        h.image_url, h.gallery, h.meta_title, h.meta_description, h.active
      FROM hospitals h LEFT JOIN areas a ON a.id=h.area_id ORDER BY h.sort, h.id
    `),
    // Areas carry district_id + district labels so the client can filter thanas by chosen district.
    db.execute<{
      id: number; name_bn: string; name_en: string | null;
      district_id: number | null; district_bn: string | null; district_en: string | null;
    }>(sql`
      SELECT a.id, a.name->>'bn' AS name_bn, a.name->>'en' AS name_en,
        a.district_id, d.name->>'bn' AS district_bn, d.name->>'en' AS district_en
      FROM areas a LEFT JOIN districts d ON d.id = a.district_id
      WHERE a.active ORDER BY a.sort
    `),
    db.execute<{ id: number; name_bn: string; name_en: string | null }>(sql`
      SELECT id, name->>'bn' AS name_bn, name->>'en' AS name_en FROM specialties WHERE active ORDER BY sort, id
    `),
    db.execute<{ id: number; name_bn: string; name_en: string | null }>(sql`
      SELECT id, name->>'bn' AS name_bn, name->>'en' AS name_en FROM districts WHERE active ORDER BY sort, id
    `),
  ]);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">হাসপাতাল ও ক্লিনিক / Hospitals & Clinics</h1>
      <HospitalsManager
        rows={hospitalsRes.rows}
        areas={areasRes.rows}
        specialties={specialtiesRes.rows}
        districts={districtsRes.rows}
      />
    </div>
  );
}
