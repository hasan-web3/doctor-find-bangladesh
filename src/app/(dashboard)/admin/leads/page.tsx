import Link from "next/link";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { LeadRow } from "./row";
import { ContactEmailSettings } from "./email-settings";
import { Pagination } from "@/components/admin/pagination";
import { DebouncedSearch } from "@/components/admin/debounced-search";
import { searchClause } from "@/lib/admin-search";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const TABS = [["", "সব"], ["new", "নতুন"], ["in_progress", "চলমান"], ["resolved", "সমাধান"]] as const;

// One inbox, one form. The site used to run two separate contact forms
// (patient support on /contact, doctor promotion on /for-doctors) and this page
// carried a type filter to separate them. There is now a single contact form,
// so every lead lands in the same list and the type chips are gone — status is
// the only axis worth filtering on. The `type` COLUMN is left untouched in the
// database so historic rows keep their value.
type SP = { status?: string; q?: string; page?: string; perPage?: string };

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = Number(sp.perPage) || 30;

  const conds: SQL[] = [sql`TRUE`];
  if (sp.status) conds.push(sql`status = ${sp.status}::lead_status`);
  if (sp.q?.trim()) conds.push(searchClause(sp.q, [sql`name`, sql`phone`, sql`email`, sql`message`]));
  const where = sql.join(conds, sql` AND `);

  const [rowsRes, totalRes, settings] = await Promise.all([
    db.execute<{
      id: number; name: string; phone: string; email: string | null; message: string | null;
      status: "new" | "in_progress" | "resolved"; created_at: string; extra: { note?: string };
    }>(sql`
    SELECT id, name, phone, email, message, status, created_at::text, extra FROM leads
    WHERE ${where} ORDER BY created_at DESC
    LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
  `),
    db.execute<{ c: number }>(sql`SELECT COUNT(*)::int AS c FROM leads WHERE ${where}`),
    getSettings(),
  ]);
  const rows = rowsRes.rows;
  const totalPages = Math.ceil((totalRes.rows[0]?.c ?? 0) / perPage);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">লিড / যোগাযোগ</h1>

      <ContactEmailSettings
        initialFrom={settings.contact_email_from || ""}
        initialBcc={settings.contact_email_bcc || ""}
      />

      <div className="mb-[18px] flex flex-wrap gap-2">
        {TABS.map(([value, label]) => (
          <Link prefetch={false}
            key={value}
            href={`/admin/leads${value ? `?status=${value}` : ""}`}
            className={`rounded-full border px-[18px] py-2 text-[13.5px] font-semibold ${
              (sp.status || "") === value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-white text-ink-mute"
            }`}
          >
            {label}
          </Link>
        ))}
        <div className="ml-auto flex flex-1 justify-end">
          <DebouncedSearch initial={sp.q || ""} placeholder="নাম, ফোন বা বার্তা" />
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        {rows.map((l) => <LeadRow key={l.id} lead={l} />)}
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-ink-ghost">
            কোনো লিড নেই।
          </div>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        perPage={perPage}
        showPerPageSelector={true}
      />
    </div>
  );
}
