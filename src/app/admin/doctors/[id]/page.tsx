import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { toML, EMPTY_SOCIAL_LINKS, type SocialLinksDraft } from "@/lib/utils";
import { DoctorForm, type DoctorInitial } from "../doctor-form";

export const dynamic = "force-dynamic";

type MLRaw = { bn?: string; en?: string } | null;

export default async function EditDoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doctorId = Number(id);
  if (!Number.isFinite(doctorId)) notFound();

  const { rows: docRows } = await db.execute<{
    id: number; slug: string; name: MLRaw; degrees: MLRaw; bio: MLRaw;
    gender: string | null; experience_years: number | null; patients_served: MLRaw;
    hospital_id: number | null;
    verified: boolean; featured: boolean; active: boolean;
    meta_title: MLRaw; meta_description: MLRaw; photo_url: string | null;
    social_links: Partial<SocialLinksDraft> | null;
  }>(sql`SELECT * FROM doctors WHERE id=${doctorId}`);
  const doc = docRows[0];
  if (!doc) notFound();

  const [specialtyIdsRes, chambersRes, specialtiesRes, areasRes, hospitalsRes, districtsRes] = await Promise.all([
    db.execute<{ specialty_id: number }>(
      sql`SELECT specialty_id FROM doctor_specialties WHERE doctor_id=${doctorId} ORDER BY is_primary DESC`
    ),
    // Chamber row also brings back the area's district so the district select
    // starts populated and the area select shows the correct filtered list.
    db.execute<{
      id: number; name: MLRaw; address: MLRaw; area_id: number | null; district_id: number | null;
      fee: number; phone: string | null; map_url: string | null;
      visible: boolean; lat: number | null; lng: number | null;
      schedule: { days: MLRaw; time: MLRaw }[];
    }>(sql`
      SELECT c.id, c.name, c.address, c.area_id, a.district_id,
        c.fee, c.phone, c.map_url, c.visible, c.lat, c.lng, c.schedule
      FROM chambers c LEFT JOIN areas a ON a.id = c.area_id
      WHERE c.doctor_id=${doctorId} ORDER BY c.sort
    `),
    db.execute<{ id: number; name_bn: string; name_en: string | null }>(
      sql`SELECT id, name->>'bn' AS name_bn, name->>'en' AS name_en FROM specialties WHERE active ORDER BY sort`
    ),
    db.execute<{
      id: number; name_bn: string; name_en: string | null;
      district_id: number | null; district_bn: string | null; district_en: string | null;
    }>(sql`
      SELECT a.id, a.name->>'bn' AS name_bn, a.name->>'en' AS name_en,
        a.district_id, d.name->>'bn' AS district_bn, d.name->>'en' AS district_en
      FROM areas a LEFT JOIN districts d ON d.id = a.district_id
      WHERE a.active ORDER BY a.sort
    `),
    db.execute<{ id: number; name_bn: string; name_en: string | null }>(
      sql`SELECT id, name->>'bn' AS name_bn, name->>'en' AS name_en FROM hospitals WHERE active ORDER BY sort`
    ),
    db.execute<{ id: number; name_bn: string; name_en: string | null }>(
      sql`SELECT id, name->>'bn' AS name_bn, name->>'en' AS name_en FROM districts WHERE active ORDER BY sort`
    ),
  ]);
  const specialtyIds = specialtyIdsRes.rows;
  const chambers = chambersRes.rows;

  const initial: DoctorInitial = {
    id: doc.id,
    name: toML(doc.name),
    slug: doc.slug,
    degrees: toML(doc.degrees),
    bio: toML(doc.bio),
    gender: doc.gender,
    experience_years: doc.experience_years,
    patients_served: toML(doc.patients_served),
    hospital_id: doc.hospital_id ?? null,
    verified: doc.verified,
    featured: doc.featured,
    active: doc.active,
    meta_title: toML(doc.meta_title),
    meta_description: toML(doc.meta_description),
    photo_url: doc.photo_url,
    social_links: { ...EMPTY_SOCIAL_LINKS(), ...(doc.social_links || {}) },
    specialty_ids: specialtyIds.map((r) => r.specialty_id),
    chambers: chambers.map((c) => ({
      id: c.id,
      name: toML(c.name),
      address: toML(c.address),
      district_id: c.district_id,
      area_id: c.area_id,
      fee: c.fee,
      phone: c.phone || "",
      map_url: c.map_url || "",
      visible: c.visible,
      lat: c.lat,
      lng: c.lng,
      schedule:
        Array.isArray(c.schedule) && c.schedule.length > 0
          ? c.schedule.map((s) => ({ days: toML(s.days), time: toML(s.time) }))
          : [{ days: { bn: "", en: "" }, time: { bn: "", en: "" } }],
    })),
  };

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">ডাক্তার এডিট: {initial.name.bn}</h1>
      <DoctorForm
        initial={initial}
        specialties={specialtiesRes.rows}
        areas={areasRes.rows}
        hospitals={hospitalsRes.rows}
        districts={districtsRes.rows}
      />
    </div>
  );
}
