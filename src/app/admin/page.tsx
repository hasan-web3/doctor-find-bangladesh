import Link from "next/link";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/admin/ui";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { expirePromotions } from "@/lib/data";
import { bnNum, bnMoney, bnDateTime, bnDate } from "@/lib/bn";

export const dynamic = "force-dynamic";

const APPT_TONES: Record<string, { tone: "blue" | "green" | "gray" | "red"; label: string }> = {
  new: { tone: "blue", label: "নতুন" },
  confirmed: { tone: "green", label: "নিশ্চিত" },
  completed: { tone: "gray", label: "সম্পন্ন" },
  cancelled: { tone: "red", label: "বাতিল" },
};

export default async function AdminDashboard() {
  // Lazy auto-expiry: promotions past end date are expired and featured flags synced.
  await expirePromotions();

  const [totalsRes, monthlyRes, expiringRes, recentApptsRes, recentAuditRes] = await Promise.all([
    db.execute<{ doctors: number; featured: number; today_appts: number; month_revenue: number; new_leads: number }>(sql`
      SELECT
        (SELECT COUNT(*)::int FROM doctors WHERE active) AS doctors,
        (SELECT COUNT(*)::int FROM doctors WHERE active AND featured) AS featured,
        (SELECT COUNT(*)::int FROM appointments WHERE visit_date = CURRENT_DATE) AS today_appts,
        (SELECT COALESCE(SUM(amount),0)::int FROM promotions WHERE starts_on >= date_trunc('month', CURRENT_DATE)) AS month_revenue,
        (SELECT COUNT(*)::int FROM leads WHERE status='new') AS new_leads
    `),
    db.execute<{ month: string; revenue: number; appts: number }>(sql`
      WITH months AS (
        SELECT date_trunc('month', CURRENT_DATE) - (INTERVAL '1 month' * s) AS m
        FROM generate_series(6, 0, -1) s
      )
      SELECT to_char(m, 'Mon') AS month,
        COALESCE((SELECT SUM(p.amount)::int FROM promotions p WHERE date_trunc('month', p.starts_on) = m), 0) AS revenue,
        COALESCE((SELECT COUNT(*)::int FROM appointments a WHERE date_trunc('month', a.created_at) = m), 0) AS appts
      FROM months ORDER BY m
    `),
    db.execute<{ id: number; name_bn: string; plan: string; ends_on: string }>(sql`
      SELECT p.id, d.name->>'bn' AS name_bn, p.plan, p.ends_on::text FROM promotions p
      JOIN doctors d ON d.id = p.doctor_id
      WHERE p.status='active' AND p.ends_on BETWEEN CURRENT_DATE AND CURRENT_DATE + 14
      ORDER BY p.ends_on LIMIT 5
    `),
    db.execute<{ id: number; patient_name: string; doctor_bn: string; visit_date: string; time_slot: string; status: string; created_at: string }>(sql`
      SELECT a.id, a.patient_name, d.name->>'bn' AS doctor_bn, a.visit_date::text, a.time_slot, a.status, a.created_at::text
      FROM appointments a JOIN doctors d ON d.id = a.doctor_id
      ORDER BY a.created_at DESC LIMIT 6
    `),
    db.execute<{ id: number; actor_name: string; action: string; entity: string; created_at: string }>(sql`
      SELECT id, actor_name, action, entity, created_at::text FROM audit_log ORDER BY created_at DESC LIMIT 8
    `),
  ]);
  const totals = totalsRes.rows[0];
  const monthly = monthlyRes.rows;
  const expiring = expiringRes.rows;
  const recentAppts = recentApptsRes.rows;
  const recentAudit = recentAuditRes.rows;

  const maxRev = Math.max(...monthly.map((m) => m.revenue), 1);
  const maxAppt = Math.max(...monthly.map((m) => m.appts), 1);

  const stats = [
    { label: "মোট ডাক্তার", value: bnNum(totals?.doctors ?? 0), icon: "user", bg: "#F0FDFA", fg: "#0D9488", href: "/admin/doctors" },
    { label: "ফিচার্ড ডাক্তার", value: bnNum(totals?.featured ?? 0), icon: "shield", bg: "#ECFDF5", fg: "#059669", href: "/admin/promotions" },
    { label: "আজকের অ্যাপয়েন্টমেন্ট", value: bnNum(totals?.today_appts ?? 0), icon: "calendar", bg: "#EFF6FF", fg: "#2563EB", href: "/admin/appointments" },
    { label: "চলতি মাসের প্রমোশন আয়", value: bnMoney(totals?.month_revenue ?? 0), icon: "chart", bg: "#FFF7ED", fg: "#EA580C", href: "/admin/promotions" },
  ];

  const BN_MONTHS: Record<string, string> = {
    Jan: "জান", Feb: "ফেব", Mar: "মার্চ", Apr: "এপ্রিল", May: "মে", Jun: "জুন",
    Jul: "জুলাই", Aug: "আগস্ট", Sep: "সেপ্ট", Oct: "অক্টো", Nov: "নভে", Dec: "ডিসে",
  };

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">ড্যাশবোর্ড</h1>

      {/* stat cards */}
      <div className="mb-[22px] grid grid-cols-2 gap-4 min-[900px]:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-2xl border border-line bg-white p-5 transition-shadow hover:shadow-card">
            <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: s.bg, color: s.fg }}>
              <Icon name={s.icon} size={22} />
            </div>
            <div className="font-heading text-[26px] font-extrabold leading-none text-ink">{s.value}</div>
            <div className="mt-[5px] text-[13.5px] text-ink-faint">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="mb-[22px] grid grid-cols-1 gap-4 min-[1000px]:grid-cols-[1.7fr_1fr]">
        {/* revenue chart */}
        <div className="rounded-2xl border border-line bg-white p-[22px]">
          <div className="mb-5 flex items-center justify-between">
            <div className="font-heading text-base font-bold text-ink">আয় ও অ্যাপয়েন্টমেন্ট (মাসিক)</div>
            <div className="flex gap-3.5 text-[12.5px]">
              <span className="flex items-center gap-1.5 text-ink-mute">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-brand-600" />আয়
              </span>
              <span className="flex items-center gap-1.5 text-ink-mute">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-[#93C5FD]" />অ্যাপয়েন্টমেন্ট
              </span>
            </div>
          </div>
          <div className="flex h-[180px] items-end gap-3.5">
            {monthly.map((m) => (
              <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div
                    className="w-[40%] rounded-t-[5px] [background:linear-gradient(180deg,#0D9488,#5EEAD4)]"
                    style={{ height: `${Math.max((m.revenue / maxRev) * 100, 2)}%` }}
                    title={bnMoney(m.revenue)}
                  />
                  <div
                    className="w-[40%] rounded-t-[5px] bg-[#93C5FD]"
                    style={{ height: `${Math.max((m.appts / maxAppt) * 100, 2)}%` }}
                    title={bnNum(m.appts)}
                  />
                </div>
                <span className="text-[11.5px] text-ink-ghost">{BN_MONTHS[m.month] || m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* expiring promotions */}
        <div className="rounded-2xl border border-line bg-white p-[22px]">
          <div className="mb-4 font-heading text-base font-bold text-ink">মেয়াদ শেষ হচ্ছে</div>
          {expiring.length > 0 ? (
            <div className="flex flex-col gap-3">
              {expiring.map((e) => (
                <div key={e.id} className="flex items-center gap-3 rounded-[11px] bg-[#FFFBEB] p-3">
                  <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[#FEF3C7] text-base text-[#B45309]">⏳</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{e.name_bn}</div>
                    <div className="text-xs text-ink-ghost">
                      {e.plan === "premium" ? "প্রিমিয়াম" : e.plan === "featured" ? "ফিচার্ড" : "বেসিক"} প্ল্যান
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-xs font-bold text-[#B45309]">{bnDate(e.ends_on)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-ghost">আগামী ১৪ দিনে কোনো প্রমোশনের মেয়াদ শেষ হচ্ছে না।</p>
          )}
        </div>
      </div>

      {/* recent appointments */}
      <div className="mb-[22px] overflow-x-auto rounded-2xl border border-line bg-white p-[22px]">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-base font-bold text-ink">সাম্প্রতিক অ্যাপয়েন্টমেন্ট</div>
          <Link href="/admin/appointments" className="text-[13px] font-semibold text-brand-600">সব দেখুন →</Link>
        </div>
        {recentAppts.length > 0 ? (
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="text-right">
                {["রোগী", "ডাক্তার", "সময়", "স্ট্যাটাস"].map((h) => (
                  <th key={h} className="border-b border-line px-3 py-2.5 text-right text-[12.5px] font-semibold text-ink-ghost">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentAppts.map((a) => (
                <tr key={a.id}>
                  <td className="border-b border-[#F1F5F9] px-3 py-3 text-sm font-semibold text-ink">{a.patient_name}</td>
                  <td className="border-b border-[#F1F5F9] px-3 py-3 text-sm text-ink-mute">{a.doctor_bn}</td>
                  <td className="border-b border-[#F1F5F9] px-3 py-3 text-[13.5px] text-ink-faint">
                    {bnDate(a.visit_date)}, {a.time_slot}
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3 py-3">
                    <StatusBadge tone={APPT_TONES[a.status]?.tone || "gray"}>{APPT_TONES[a.status]?.label || a.status}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-ink-ghost">এখনো কোনো অ্যাপয়েন্টমেন্ট নেই।</p>
        )}
      </div>

      {/* recent activity */}
      <div className="rounded-2xl border border-line bg-white p-[22px]">
        <div className="mb-4 font-heading text-base font-bold text-ink">সাম্প্রতিক কার্যক্রম</div>
        {recentAudit.length > 0 ? (
          <div className="flex flex-col gap-2">
            {recentAudit.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center gap-x-2 border-b border-[#F1F5F9] py-2 text-[13.5px] last:border-0">
                <span className="font-semibold text-ink">{log.actor_name}</span>
                <span className="text-ink-faint">{log.action}</span>
                <span className="rounded bg-page px-1.5 py-0.5 font-latin text-xs text-ink-mute">{log.entity}</span>
                <span className="mr-auto" />
                <span className="text-xs text-ink-ghost">{bnDateTime(log.created_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-ghost">কোনো কার্যক্রম রেকর্ড নেই।</p>
        )}
      </div>
    </div>
  );
}
