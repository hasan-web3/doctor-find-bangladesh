import { sql } from "drizzle-orm";
import { db } from "@/db";
import { TestimonialsManager, type TestimonialRow } from "./manager";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialsPage() {
  const { rows } = await db.execute<TestimonialRow>(sql`
    SELECT id, name, area_text, quote, published, sort, photo_url FROM testimonials ORDER BY sort, id
  `);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">রোগীদের মতামত</h1>
      <TestimonialsManager rows={rows} />
    </div>
  );
}
