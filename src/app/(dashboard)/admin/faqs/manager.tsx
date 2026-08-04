"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFaq } from "@/actions/admin-content";
import { Toast, StatusBadge, ConfirmButton } from "@/components/admin/ui";
import { toML } from "@/lib/utils";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { FaqForm, EMPTY_FAQ, type FaqDraft } from "./form";

export type FaqRow = {
  id: number; scope: string; ref_id: number | null; question: unknown; answer: unknown;
  sort: number; active: boolean;
};

type Opt = { id: number; name_bn: string };
export type Refs = { specialty: Opt[]; area: Opt[]; hospital: Opt[]; doctor: Opt[] };

const SCOPES = [
  ["home", "হোমপেজ"], ["specialty", "বিভাগ"], ["area", "থানা / উপজেলা"], ["hospital", "হাসপাতাল"], ["doctor", "ডাক্তার"],
] as const;


export function FaqsManager({ rows, refs }: { rows: FaqRow[]; refs: Refs }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<FaqDraft | null>(null);

  const refName = (scope: string, refId: number | null) => {
    if (scope === "home" || !refId) return "হোমপেজ";
    const list = refs[scope as keyof Refs] || [];
    return list.find((x) => x.id === refId)?.name_bn || `#${refId}`;
  };

  const scopeLabel = (scope: string) => SCOPES.find(([v]) => v === scope)?.[1] || scope;

  const handleClose = () => {
    setEditing(null);
    router.refresh();
  }

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setEditing({ ...EMPTY_FAQ, sort: rows.length })}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + নতুন FAQ
        </button>
      </div>

      <FullPageModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "FAQ এডিট" : "নতুন FAQ"}
        hideHeader={true}
      >
        {editing && <FaqForm initial={editing} refs={refs} onFinished={handleClose} />}
      </FullPageModal>

      <div className="flex flex-col gap-3">
        {rows.map((f) => {
          const question = toML(f.question);
          const answer = toML(f.answer);
          return (
            <div key={f.id} className="flex flex-wrap items-start gap-3.5 rounded-[14px] border border-line bg-white p-[18px]">
              <div className="min-w-[220px] flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold text-ink">{question.bn}</span>
                  <StatusBadge tone="blue">{scopeLabel(f.scope)}: {refName(f.scope, f.ref_id)}</StatusBadge>
                  {!f.active && <StatusBadge tone="gray">নিষ্ক্রিয়</StatusBadge>}
                </div>
                <p className="m-0 text-sm text-ink-mute">{answer.bn}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing({ id: f.id, scope: f.scope, ref_id: f.ref_id, question: toML(f.question), answer: toML(f.answer), sort: f.sort, active: f.active })}
                  className="rounded-[9px] border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-600"
                >
                  এডিট
                </button>
                <ConfirmButton
                  onConfirm={() =>
                    startTransition(async () => {
                      await deleteFaq(f.id);
                      router.refresh();
                    })
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
