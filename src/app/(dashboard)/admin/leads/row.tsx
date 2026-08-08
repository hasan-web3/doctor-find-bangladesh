"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLeadStatus } from "@/actions/admin-system";
import { StatusBadge } from "@/components/admin/ui";
import { NewFlag, useNewRows } from "@/components/admin/notifications";
import { cn } from "@/lib/utils";
import { dateTime } from "@/lib/i18n";

// `type` is intentionally absent: the site runs one contact form now, so every
// lead is the same kind and a per-row type badge only added noise. The column
// still exists in the database for historic rows — see the note on the list
// page — it just isn't surfaced here.
type Lead = {
  id: number; name: string; phone: string; email: string | null; message: string | null;
  status: "new" | "in_progress" | "resolved"; created_at: string; extra: { note?: string };
};

export function LeadRow({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const newRows = useNewRows("leads");
  const isNew = newRows.isNew(lead.id);

  const setStatus = (status: Lead["status"]) =>
    startTransition(async () => {
      await updateLeadStatus(lead.id, status);
      router.refresh();
    });

  return (
    <div
      // Touching the card at all counts as seeing it — that includes the
      // action buttons inside, whose clicks bubble up here.
      onClick={() => newRows.markRead(lead.id)}
      className={cn(
        "flex flex-wrap items-start gap-3.5 rounded-[14px] border p-[18px]",
        isNew ? "border-brand-500 bg-brand-100" : "border-line bg-white"
      )}
    >
      <div className="min-w-[200px] flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
          <span className="text-[15px] font-bold text-ink">{lead.name}</span>
          {isNew && <NewFlag />}
          <StatusBadge tone={lead.status === "new" ? "blue" : lead.status === "in_progress" ? "amber" : "green"}>
            {lead.status === "new" ? "নতুন" : lead.status === "in_progress" ? "চলমান" : "সমাধান হয়েছে"}
          </StatusBadge>
        </div>
        {lead.message && <div className="mb-1 text-sm text-ink-mute">{lead.message}</div>}
        {lead.extra?.note && <div className="mb-1 text-[13px] text-ink-faint">বিভাগ: {lead.extra.note}</div>}
        {/* Phone is printed exactly as the visitor typed it — converting it to
            Bangla digits made it useless to copy into a dialer or a search. */}
        <div className="font-latin text-[12.5px] text-ink-ghost">
          ✆ {lead.phone} · {dateTime(lead.created_at, "en")}
        </div>
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="mt-0.5 inline-block font-latin text-[12.5px] text-brand-700">
            {lead.email}
          </a>
        )}
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
