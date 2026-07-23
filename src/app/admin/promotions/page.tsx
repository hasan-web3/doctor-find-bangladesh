import { sql } from "drizzle-orm";
import { db } from "@/db";
import { expirePromotions } from "@/lib/data";
import { PromotionsManager } from "./manager";
import { bnNum, bnMoney } from "@/lib/bn";

export const dynamic = "force-dynamic";

type SP = { page?: string; perPage?: string };

export default async function AdminPromotionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Number(sp.perPage) || 30;

  await expirePromotions();

  const [statsRes, rowsRes, totalRes, doctorsRes] = await Promise.all([
    db.execute<{ month_revenue: number; active: number; expiring: number; new_leads: number }>(sql`
      SELECT
        (SELECT COALESCE(SUM(amount),0)::int FROM promotions WHERE starts_on >= date_trunc('month', CURRENT_DATE)) AS month_revenue,
        (SELECT COUNT(*)::int FROM promotions WHERE status='active') AS active,
        (SELECT COUNT(*)::int FROM promotions WHERE status='active' AND ends_on BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS expiring,
        (SELECT COUNT(*)::int FROM leads WHERE status='new' AND type='doctor') AS new_leads
    `),
    db.execute<{
      id: number; doctor_id: number; doctor_bn: string; plan: string; amount: number;
      starts_on: string; ends_on: string; status: string; notes: string | null;
    }>(sql`
      SELECT p.id, p.doctor_id, d.name->>'bn' AS doctor_bn, p.plan, p.amount,
        p.starts_on::text, p.ends_on::text, p.status, p.notes
      FROM promotions p JOIN doctors d ON d.id = p.doctor_id
      ORDER BY p.created_at DESC
      LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `),
    db.execute<{ c: number }>(sql`SELECT COUNT(*)::int as c FROM promotions`),
    db.execute<{ id: number; name_bn: string }>(sql`SELECT id, name->>'bn' AS name_bn FROM doctors ORDER BY name->>'bn'`),
  ]);
  const stats = statsRes.rows[0];
  const rows = rowsRes.rows;
  const doctors = doctorsRes.rows;
  const totalPages = Math.ceil((totalRes.rows[0]?.c ?? 0) / perPage);

  const cards = [
    { label: "চলতি মাসের আয়", value: bnMoney(stats?.month_revenue ?? 0) },
    { label: "সক্রিয় প্রমোশন", value: bnNum(stats?.active ?? 0) },
    { label: "এই সপ্তাহে মেয়াদ শেষ", value: bnNum(stats?.expiring ?? 0), warn: true },
    { label: "নতুন ডাক্তার লিড", value: bnNum(stats?.new_leads ?? 0) },
  ];

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">প্রমোশন ও পেমেন্ট</h1>

      <div className="mb-5 grid grid-cols-2 gap-4 min-[900px]:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-white p-5">
            <div className="text-[13px] text-ink-faint">{c.label}</div>
            <div className={`mt-1.5 font-heading text-2xl font-extrabold ${c.warn ? "text-warm-text" : "text-ink"}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <PromotionsManager
        rows={rows}
        doctors={doctors}
        totalPages={totalPages}
        page={page}
        perPage={perPage}
      />
    </div>
  );
}
