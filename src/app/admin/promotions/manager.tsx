"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePromotion } from "@/actions/admin-system";
import { Toast, StatusBadge, ConfirmButton } from "@/components/admin/ui";
import { Pagination } from "@/components/admin/pagination";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { PromotionForm, EMPTY_PROMOTION, type PromotionDraft } from "./form";
import { bnMoney, bnDate } from "@/lib/bn";

type Row = {
  id: number; doctor_id: number; doctor_bn: string; plan: string; amount: number;
  starts_on: string; ends_on: string; status: string; notes: string | null;
};

const PLAN_LABEL: Record<string, string> = { basic: "বেসিক", featured: "ফিচার্ড", premium: "প্রিমিয়াম" };

export function PromotionsManager({
  rows,
  doctors,
  totalPages,
  page,
  perPage,
}: {
  rows: Row[];
  doctors: { id: number; name_bn: string }[];
  totalPages: number;
  page: number;
  perPage: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<PromotionDraft | null>(null);

  const handleClose = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex items-center justify-between">
        <div className="font-heading text-[17px] font-bold text-ink">পেমেন্ট রেকর্ড</div>
        <button
          onClick={() => setEditing({ ...EMPTY_PROMOTION })}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + পেমেন্ট যুক্ত করুন
        </button>
      </div>

      <FullPageModal
        isOpen={!!editing}
        onClose={handleClose}
        title={editing?.id ? "পেমেন্ট এডিট" : "নতুন পেমেন্ট"}
        hideHeader={true}
      >
        {editing && <PromotionForm initial={editing} doctors={doctors} onFinished={handleClose} />}
      </FullPageModal>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr>
              {["ডাক্তার", "প্ল্যান", "পরিমাণ", "শুরু", "মেয়াদ শেষ", "স্ট্যাটাস", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3 text-left text-[12.5px] font-semibold text-ink-ghost">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">{p.doctor_bn}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{PLAN_LABEL[p.plan]}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">{bnMoney(p.amount)}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-faint">{bnDate(p.starts_on)}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-faint">{bnDate(p.ends_on)}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                  <StatusBadge tone={p.status === "active" ? "green" : p.status === "expired" ? "red" : "gray"}>
                    {p.status === "active" ? "সক্রিয়" : p.status === "expired" ? "মেয়াদ শেষ" : "বাতিল"}
                  </StatusBadge>
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setEditing({
                        id: p.id, doctor_id: p.doctor_id, plan: p.plan, amount: p.amount,
                        starts_on: p.starts_on, ends_on: p.ends_on, status: p.status, notes: p.notes || "",
                      })}
                      className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                    >
                      এডিট
                    </button>
                    <ConfirmButton
                      onConfirm={() =>
                        startTransition(async () => {
                          const res = await deletePromotion(p.id);
                          setResult(res);
                          router.refresh();
                        })
                      }
                    />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-ghost">কোনো পেমেন্ট রেকর্ড নেই।</td></tr>
            )}
          </tbody>
        </table>
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
