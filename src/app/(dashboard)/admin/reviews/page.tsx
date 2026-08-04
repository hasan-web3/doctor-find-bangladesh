import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { searchClause } from "@/lib/admin-search";
import { ReviewsManager } from "./manager";

export const dynamic = "force-dynamic";

type SP = { q?: string };

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const searchCond: SQL = q
    ? searchClause(q, [sql`r.name`, sql`r.body`, sql`r.area_text`, sql`d.name->>'bn'`, sql`d.name->>'en'`])
    : sql`TRUE`;

  const [reviewsRes, doctorsRes] = await Promise.all([
    db.execute<{
      id: number; doctor_id: number; doctor_bn: string; name: string; area_text: string | null;
      body: string | null; published: boolean; created_at: string;
    }>(sql`
      SELECT r.id, r.doctor_id, d.name->>'bn' AS doctor_bn, r.name, r.area_text, r.body, r.published, r.created_at::text
      FROM reviews r JOIN doctors d ON d.id = r.doctor_id
      WHERE ${searchCond}
      ORDER BY r.created_at DESC LIMIT 100
    `),
    db.execute<{ id: number; name_bn: string }>(sql`SELECT id, name->>'bn' AS name_bn FROM doctors WHERE active ORDER BY name->>'bn'`),
  ]);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">রিভিউ মডারেশন</h1>
      <ReviewsManager reviews={reviewsRes.rows} doctors={doctorsRes.rows} q={q} />
    </div>
  );
}
