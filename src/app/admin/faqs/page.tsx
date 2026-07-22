import { sql } from "drizzle-orm";
import { db } from "@/db";
import { FaqsManager, type FaqRow } from "./manager";

export const dynamic = "force-dynamic";

export default async function AdminFaqsPage() {
  const [rowsRes, specialtiesRes, areasRes, hospitalsRes, doctorsRes] = await Promise.all([
    db.execute<FaqRow>(sql`SELECT id, scope, ref_id, question, answer, sort, active FROM faqs ORDER BY scope, sort, id`),
    db.execute<{ id: number; name_bn: string }>(sql`SELECT id, name->>'bn' AS name_bn FROM specialties ORDER BY sort`),
    db.execute<{ id: number; name_bn: string }>(sql`SELECT id, name->>'bn' AS name_bn FROM areas ORDER BY sort`),
    db.execute<{ id: number; name_bn: string }>(sql`SELECT id, name->>'bn' AS name_bn FROM hospitals ORDER BY sort`),
    db.execute<{ id: number; name_bn: string }>(sql`SELECT id, name->>'bn' AS name_bn FROM doctors ORDER BY name->>'bn' LIMIT 500`),
  ]);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">FAQ</h1>
      <p className="mb-5 mt-0 text-sm text-ink-faint">
        FAQ হোমপেজ, নির্দিষ্ট বিভাগ, এলাকা, হাসপাতাল বা ডাক্তারের পেজে যুক্ত করা যায়। প্রতিটি FAQ পেজে JSON-LD (FAQPage) হিসেবেও যুক্ত হয়।
      </p>
      <FaqsManager
        rows={rowsRes.rows}
        refs={{ specialty: specialtiesRes.rows, area: areasRes.rows, hospital: hospitalsRes.rows, doctor: doctorsRes.rows }}
      />
    </div>
  );
}
