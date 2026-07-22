"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLeadStatus } from "@/actions/admin-system";
import { StatusBadge } from "@/components/admin/ui";
import { bnNum, bnDateTime } from "@/lib/bn";

type Lead = {
  id: number; type: "patient" | "doctor"; name: string; phone: string; message: string | null;
  status: "new" | "in_progress" | "resolved"; created_at: string; extra: { note?: string };
};

export function LeadRow({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const setStatus = (status: Lead["status"]) =>
    startTransition(async () => {
      await updateLeadStatus(lead.id, status);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-start gap-3.5 rounded-[14px] border border-line bg-white p-[18px]">
      <div className="min-w-[200px] flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
          <span className="text-[15px] font-bold text-ink">{lead.name}</span>
          <StatusBadge tone={lead.type === "doctor" ? "amber" : "blue"}>
            {lead.type === "doctor" ? "ডাক্তার প্রমোশন" : "রোগী সহায়তা"}
          </StatusBadge>
          <StatusBadge tone={lead.status === "new" ? "blue" : lead.status === "in_progress" ? "amber" : "green"}>
            {lead.status === "new" ? "নতুন" : lead.status === "in_progress" ? "চলমান" : "সমাধান হয়েছে"}
          </StatusBadge>
        </div>
        {lead.message && <div className="mb-1 text-sm text-ink-mute">{lead.message}</div>}
        {lead.extra?.note && <div className="mb-1 text-[13px] text-ink-faint">বিভাগ: {lead.extra.note}</div>}
        <div className="text-[12.5px] text-ink-ghost">
          ✆ {bnNum(lead.phone)} · {bnDateTime(lead.created_at)}
        </div>
      </div>
      <div className="flex gap-2">
        <a href={`tel:${lead.phone}`} className="rounded-[9px] border border-warm-border bg-warm-soft px-3.5 py-2 text-[13px] font-semibold text-warm">
          কল
        </a>
        {lead.status !== "in_progress" && lead.status !== "resolved" && (
          <button onClick={() => setStatus("in_progress")} disabled={pending} className="rounded-[9px] border border-line bg-white px-3.5 py-2 text-[13px] text-ink-mute disabled:opacity-60">
            চলমান
          </button>
        )}
        {lead.status !== "resolved" && (
          <button onClick={() => setStatus("resolved")} disabled={pending} className="rounded-[9px] bg-accent px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-60">
            রিজলভ
          </button>
        )}
      </div>
    </div>
  );
}
