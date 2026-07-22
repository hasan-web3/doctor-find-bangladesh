import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ReviewsManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const [reviewsRes, doctorsRes] = await Promise.all([
    db.execute<{
      id: number; doctor_id: number; doctor_bn: string; name: string; area_text: string | null;
      body: string | null; published: boolean; created_at: string;
    }>(sql`
      SELECT r.id, r.doctor_id, d.name->>'bn' AS doctor_bn, r.name, r.area_text, r.body, r.published, r.created_at::text
      FROM reviews r JOIN doctors d ON d.id = r.doctor_id ORDER BY r.created_at DESC LIMIT 100
    `),
    db.execute<{ id: number; name_bn: string }>(sql`SELECT id, name->>'bn' AS name_bn FROM doctors WHERE active ORDER BY name->>'bn'`),
  ]);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">রিভিউ মডারেশন</h1>
      <ReviewsManager reviews={reviewsRes.rows} doctors={doctorsRes.rows} />
    </div>
  );
}
