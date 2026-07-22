import { sql } from "drizzle-orm";
import { db } from "@/db";
import { DoctorForm } from "../doctor-form";
import { EMPTY_SOCIAL_LINKS } from "@/lib/utils";

export const dynamic = "force-dynamic";

const emptyML = { bn: "", en: "" };

export default async function NewDoctorPage() {
  const [spRes, arRes, hoRes, diRes] = await Promise.all([
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

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">নতুন ডাক্তার যুক্ত করুন</h1>
      <DoctorForm
        initial={{
          name: { ...emptyML }, slug: "", degrees: { ...emptyML }, bio: { ...emptyML }, gender: null,
          experience_years: null, patients_served: { ...emptyML },
          hospital_id: null,
          verified: true, featured: false, active: true,
          meta_title: { ...emptyML }, meta_description: { ...emptyML }, photo_url: null,
          social_links: EMPTY_SOCIAL_LINKS(),
          specialty_ids: [],
          chambers: [{
            name: { ...emptyML }, address: { ...emptyML },
            district_id: null, area_id: null, fee: 0, phone: "", map_url: "",
            // New chambers start hidden — admin explicitly toggles on to publish.
            visible: false, lat: null, lng: null,
            schedule: [],
          }],
        }}
        specialties={spRes.rows}
        areas={arRes.rows}
        hospitals={hoRes.rows}
        districts={diRes.rows}
      />
    </div>
  );
}
