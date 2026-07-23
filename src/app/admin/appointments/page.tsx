import Link from "next/link";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { Pagination } from "@/components/admin/pagination";
import { AppointmentRow } from "./row";
import { num as bnNum } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const TABS = [
  ["", "সব"], ["new", "নতুন"], ["confirmed", "নিশ্চিত"], ["completed", "সম্পন্ন"], ["cancelled", "বাতিল"],
] as const;

type SP = { status?: string; q?: string; page?: string; perPage?: string };

export default async function AdminAppointmentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Number(sp.perPage) || 30;

  const conds: SQL[] = [sql`TRUE`];
  if (sp.status) conds.push(sql`a.status = ${sp.status}::appointment_status`);
  if (sp.q?.trim()) {
    const like = `%${sp.q.trim()}%`;
    conds.push(sql`(a.patient_name ILIKE ${like} OR a.phone ILIKE ${like} OR a.serial_no ILIKE ${like})`);
  }
  const where = sql.join(conds, sql` AND `);

  const [rowsRes, totalRes] = await Promise.all([
    db.execute<{
      id: number; serial_no: string; patient_name: string; phone: string; age: string | null;
      problem: string | null; visit_date: string; time_slot: string; status: string;
      doctor_bn: string; chamber_bn: string | null;
    }>(sql`
      SELECT a.id, a.serial_no, a.patient_name, a.phone, a.age, a.problem,
        a.visit_date::text, a.time_slot, a.status, d.name->>'bn' AS doctor_bn, c.name->>'bn' AS chamber_bn
      FROM appointments a
      JOIN doctors d ON d.id = a.doctor_id
      LEFT JOIN chambers c ON c.id = a.chamber_id
      WHERE ${where}
      ORDER BY a.created_at DESC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `),
    db.execute<{ c: number }>(sql`SELECT COUNT(*)::int AS c FROM appointments a WHERE ${where}`),
  ]);
  const rows = rowsRes.rows;
  const totalRow = totalRes.rows[0];
  const totalPages = Math.ceil((totalRow?.c ?? 0) / perPage);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">অ্যাপয়েন্টমেন্ট</h1>

      <div className="mb-[18px] flex flex-wrap items-center gap-2">
        {TABS.map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/appointments${value ? `?status=${value}` : ""}`}
            className={`rounded-full border px-[18px] py-2 text-[13.5px] font-semibold ${
              (sp.status || "") === value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-white text-ink-mute"
            }`}
          >
            {label}
          </Link>
        ))}
        <form className="mr-auto flex min-w-[200px] items-center gap-2 rounded-[10px] border border-line bg-white px-3">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <span className="text-ink-ghost">⌕</span>
          <input name="q" defaultValue={sp.q || ""} placeholder="নাম, ফোন বা সিরিয়াল" className="flex-1 border-none bg-transparent py-2 text-sm outline-none" />
        </form>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((a) => <AppointmentRow key={a.id} appt={a} />)}
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-ink-ghost">
            কোনো অ্যাপয়েন্টমেন্ট পাওয়া যায়নি।
          </div>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        locale="bn"
        perPage={perPage}
        showPerPageSelector
      />
      <div className="mt-2 text-[13px] text-ink-ghost">মোট {bnNum(totalRow?.c ?? 0, "bn")}টি</div>
    </div>
  );
}
