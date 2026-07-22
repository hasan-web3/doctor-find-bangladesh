import Link from "next/link";
import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { StatusBadge } from "@/components/admin/ui";
import { Pagination } from "@/components/public/pagination";
import { bnNum, bnDate } from "@/lib/bn";
import { DeleteDoctorButton } from "./delete-button";

export const dynamic = "force-dynamic";

type SP = { q?: string; page?: string; filter?: string };

export default async function AdminDoctorsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = 15;

  const conds: SQL[] = [sql`TRUE`];
  if (q) conds.push(sql`(d.name->>'bn' ILIKE ${`%${q}%`} OR d.name->>'en' ILIKE ${`%${q}%`})`);
  if (sp.filter === "featured") conds.push(sql`d.featured`);
  if (sp.filter === "inactive") conds.push(sql`NOT d.active`);
  const where = sql.join(conds, sql` AND `);

  const [rowsRes, totalRes] = await Promise.all([
    db.execute<{
      id: number; slug: string; name_bn: string; verified: boolean; featured: boolean; active: boolean;
      specialty_bn: string | null; area_bn: string | null; promo_ends: string | null;
    }>(sql`
      SELECT d.id, d.slug, d.name->>'bn' AS name_bn, d.verified, d.featured, d.active,
        (SELECT s.name->>'bn' FROM doctor_specialties ds JOIN specialties s ON s.id=ds.specialty_id
         WHERE ds.doctor_id=d.id ORDER BY ds.is_primary DESC LIMIT 1) AS specialty_bn,
        (SELECT a.name->>'bn' FROM chambers c JOIN areas a ON a.id=c.area_id
         WHERE c.doctor_id=d.id ORDER BY c.sort LIMIT 1) AS area_bn,
        (SELECT p.ends_on::text FROM promotions p WHERE p.doctor_id=d.id AND p.status='active'
         ORDER BY p.ends_on DESC LIMIT 1) AS promo_ends
      FROM doctors d WHERE ${where}
      ORDER BY d.updated_at DESC LIMIT ${perPage} OFFSET ${(page - 1) * perPage}
    `),
    db.execute<{ c: number }>(sql`SELECT COUNT(*)::int AS c FROM doctors d WHERE ${where}`),
  ]);
  const rows = rowsRes.rows;
  const totalRow = totalRes.rows[0];
  const totalPages = Math.ceil((totalRow?.c ?? 0) / perPage);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">ডাক্তার ম্যানেজমেন্ট</h1>

      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <form className="flex min-w-[220px] max-w-[340px] flex-1 items-center gap-2 rounded-[10px] border border-line bg-white px-3">
          <span className="text-ink-ghost">⌕</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="ডাক্তার খুঁজুন"
            className="flex-1 border-none bg-transparent py-2.5 text-sm outline-none"
          />
        </form>
        <div className="flex gap-2">
          {[["", "সব"], ["featured", "ফিচার্ড"], ["inactive", "নিষ্ক্রিয়"]].map(([value, label]) => (
            <Link
              key={value}
              href={`/admin/doctors${value ? `?filter=${value}` : ""}`}
              className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold ${
                (sp.filter || "") === value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-white text-ink-mute"
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/admin/doctors/new"
            className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
          >
            + নতুন ডাক্তার যুক্ত করুন
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr>
              {["ডাক্তার", "বিভাগ", "থানা / উপজেলা", "স্ট্যাটাস", "ফিচার্ড", "প্রমোশন মেয়াদ", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3 text-left text-[12.5px] font-semibold text-ink-ghost">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">
                  <Link href={`/admin/doctors/${d.id}`} className="hover:text-brand-600">{d.name_bn}</Link>
                  {d.verified && <span className="mr-1.5 text-xs text-accent-text"> ✓</span>}
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{d.specialty_bn || "..."}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{d.area_bn || "..."}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                  <StatusBadge tone={d.active ? "green" : "amber"}>{d.active ? "সক্রিয়" : "নিষ্ক্রিয়"}</StatusBadge>
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-xs font-bold text-[#B45309]">
                  {d.featured ? "★ হ্যাঁ" : ""}
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13px] text-ink-faint">
                  {d.promo_ends ? bnDate(d.promo_ends) : "..."}
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                  <div className="flex gap-1.5">
                    <Link
                      href={`/admin/doctors/${d.id}`}
                      className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                    >
                      এডিট
                    </Link>
                    <Link
                      href={`/doctors/${d.slug}`}
                      target="_blank"
                      className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] text-ink-mute"
                    >
                      দেখুন
                    </Link>
                    <DeleteDoctorButton id={d.id} />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-ghost">
                  কোনো ডাক্তার পাওয়া যায়নি। উপরের বাটন থেকে নতুন ডাক্তার যুক্ত করুন।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        locale="bn"
        perPage={perPage}
      />

      <div className="mt-2 text-[13px] text-ink-ghost">মোট {bnNum(totalRow?.c ?? 0)} জন ডাক্তার</div>
    </div>
  );
}
