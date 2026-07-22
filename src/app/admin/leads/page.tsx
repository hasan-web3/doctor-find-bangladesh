import Link from "next/link";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { LeadRow } from "./row";

export const dynamic = "force-dynamic";

const TABS = [["", "সব"], ["new", "নতুন"], ["in_progress", "চলমান"], ["resolved", "সমাধান"]] as const;

type SP = { status?: string; type?: string };

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const conds: SQL[] = [sql`TRUE`];
  if (sp.status) conds.push(sql`status = ${sp.status}::lead_status`);
  if (sp.type) conds.push(sql`type = ${sp.type}::lead_type`);
  const where = sql.join(conds, sql` AND `);

  const { rows } = await db.execute<{
    id: number; type: "patient" | "doctor"; name: string; phone: string; message: string | null;
    status: "new" | "in_progress" | "resolved"; created_at: string; extra: { note?: string };
  }>(sql`
    SELECT id, type, name, phone, message, status, created_at::text, extra FROM leads
    WHERE ${where} ORDER BY created_at DESC LIMIT 100
  `);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">লিড / যোগাযোগ</h1>

      <div className="mb-[18px] flex flex-wrap gap-2">
        {TABS.map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/leads${value ? `?status=${value}` : ""}`}
            className={`rounded-full border px-[18px] py-2 text-[13.5px] font-semibold ${
              (sp.status || "") === value && !sp.type ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-white text-ink-mute"
            }`}
          >
            {label}
          </Link>
        ))}
        <span className="mx-1 w-px bg-line" />
        <Link
          href="/admin/leads?type=patient"
          className={`rounded-full border px-[18px] py-2 text-[13.5px] font-semibold ${
            sp.type === "patient" ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]" : "border-line bg-white text-ink-mute"
          }`}
        >
          রোগী সহায়তা
        </Link>
        <Link
          href="/admin/leads?type=doctor"
          className={`rounded-full border px-[18px] py-2 text-[13.5px] font-semibold ${
            sp.type === "doctor" ? "border-warm-text bg-warm-soft text-warm-text" : "border-line bg-white text-ink-mute"
          }`}
        >
          ডাক্তার প্রমোশন
        </Link>
      </div>

      <div className="flex flex-col gap-3.5">
        {rows.map((l) => <LeadRow key={l.id} lead={l} />)}
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-ink-ghost">
            কোনো লিড নেই।
          </div>
        )}
      </div>
    </div>
  );
}
