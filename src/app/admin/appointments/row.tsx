"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAppointmentStatus } from "@/actions/admin-system";
import { StatusBadge } from "@/components/admin/ui";
import { num as bnNum, date as bnDate } from "@/lib/i18n";

const STATUS: Record<string, { tone: "blue" | "green" | "gray" | "red"; label: string }> = {
  new: { tone: "blue", label: "নতুন" },
  confirmed: { tone: "green", label: "নিশ্চিত" },
  completed: { tone: "gray", label: "সম্পন্ন" },
  cancelled: { tone: "red", label: "বাতিল" },
};

type Appt = {
  id: number; serial_no: string; patient_name: string; phone: string; age: string | null;
  problem: string | null; visit_date: string; time_slot: string; status: string;
  doctor_bn: string; chamber_bn: string | null;
};

export function AppointmentRow({ appt }: { appt: Appt }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const setStatus = (status: "new" | "confirmed" | "completed" | "cancelled") =>
    startTransition(async () => {
      await updateAppointmentStatus(appt.id, status);
      router.refresh();
    });

  const s = STATUS[appt.status] || STATUS.new;

  return (
    <div className="flex flex-wrap items-start gap-3.5 rounded-[14px] border border-line bg-white p-[18px]">
      <div className="min-w-[220px] flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2.5">
          <span className="text-[15px] font-bold text-ink">{appt.patient_name}</span>
          <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
          <span className="font-latin text-xs text-ink-ghost">#{appt.serial_no}</span>
        </div>
        <div className="text-sm text-ink-mute">
          {appt.doctor_bn}
          {appt.chamber_bn ? ` · ${appt.chamber_bn}` : ""} · {bnDate(appt.visit_date, "bn")}, {appt.time_slot}
        </div>
        <div className="mt-1 text-[12.5px] text-ink-ghost">
          ✆ {bnNum(appt.phone, "bn")}
          {appt.age ? ` · বয়স: ${bnNum(appt.age, "bn")}` : ""}
          {appt.problem ? ` · ${appt.problem}` : ""}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a href={`tel:${appt.phone}`} className="rounded-[9px] border border-warm-border bg-warm-soft px-3.5 py-2 text-[13px] font-semibold text-warm">
          কল
        </a>
        {appt.status === "new" && (
          <button onClick={() => setStatus("confirmed")} disabled={pending} className="rounded-[9px] bg-accent px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-60">
            নিশ্চিত করুন
          </button>
        )}
        {appt.status === "confirmed" && (
          <button onClick={() => setStatus("completed")} disabled={pending} className="rounded-[9px] bg-brand-600 px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-60">
            সম্পন্ন
          </button>
        )}
        {(appt.status === "new" || appt.status === "confirmed") && (
          <button onClick={() => setStatus("cancelled")} disabled={pending} className="rounded-[9px] border border-line bg-white px-3.5 py-2 text-[13px] text-[#DC2626] disabled:opacity-60">
            বাতিল
          </button>
        )}
        {appt.status === "cancelled" && (
          <button onClick={() => setStatus("new")} disabled={pending} className="rounded-[9px] border border-line bg-white px-3.5 py-2 text-[13px] text-ink-mute disabled:opacity-60">
            আবার খুলুন
          </button>
        )}
      </div>
    </div>
  );
}
