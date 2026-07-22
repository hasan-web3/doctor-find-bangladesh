"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFaq, deleteFaq } from "@/actions/admin-content";
import { Field, inputCls, Toggle, Toast, StatusBadge, ConfirmButton, MLInput } from "@/components/admin/ui";
import { toML, emptyML, type ML } from "@/lib/utils";

export type FaqRow = {
  id: number; scope: string; ref_id: number | null; question: unknown; answer: unknown;
  sort: number; active: boolean;
};

type Opt = { id: number; name_bn: string };
type Refs = { specialty: Opt[]; area: Opt[]; hospital: Opt[]; doctor: Opt[] };

const SCOPES = [
  ["home", "হোমপেজ"], ["specialty", "বিভাগ"], ["area", "থানা / উপজেলা"], ["hospital", "হাসপাতাল"], ["doctor", "ডাক্তার"],
] as const;

type Draft = {
  id?: number; scope: string; ref_id: number | null; question: ML; answer: ML; sort: number; active: boolean;
};

export function FaqsManager({ rows, refs }: { rows: FaqRow[]; refs: Refs }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  const refName = (scope: string, refId: number | null) => {
    if (scope === "home" || !refId) return "হোমপেজ";
    const list = refs[scope as keyof Refs] || [];
    return list.find((x) => x.id === refId)?.name_bn || `#${refId}`;
  };

  const scopeLabel = (scope: string) => SCOPES.find(([v]) => v === scope)?.[1] || scope;

  const submit = () => {
    if (!editing) return;
    if (editing.scope !== "home" && !editing.ref_id) {
      setResult({ ok: false, message: "কোন পেজে দেখাবে তা নির্বাচন করুন" });
      return;
    }
    startTransition(async () => {
      const res = await saveFaq(editing);
      setResult(res);
      if (res.ok) { setEditing(null); router.refresh(); }
    });
  };

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setEditing({ scope: "home", ref_id: null, question: { ...emptyML }, answer: { ...emptyML }, sort: rows.length, active: true })}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + নতুন FAQ
        </button>
      </div>

      {editing && (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="স্কোপ">
              <select className={inputCls} value={editing.scope} onChange={(e) => setEditing({ ...editing, scope: e.target.value, ref_id: null })}>
                {SCOPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            {editing.scope !== "home" && (
              <Field label="কোন পেজে">
                <select className={inputCls} value={editing.ref_id ?? ""} onChange={(e) => setEditing({ ...editing, ref_id: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">নির্বাচন করুন</option>
                  {(refs[editing.scope as keyof Refs] || []).map((o) => <option key={o.id} value={o.id}>{o.name_bn}</option>)}
                </select>
              </Field>
            )}
            <Field label="ক্রম">
              <input type="number" className={inputCls} value={editing.sort} onChange={(e) => setEditing({ ...editing, sort: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <MLInput label="প্রশ্ন" required value={editing.question} onChange={(v) => setEditing({ ...editing, question: v })} />
            <MLInput label="উত্তর" required textarea value={editing.answer} onChange={(v) => setEditing({ ...editing, answer: v })} />
            <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="সক্রিয়" />
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={submit} disabled={pending} className="rounded-[10px] bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-[10px] border border-line bg-white px-6 py-2.5 text-sm text-ink-mute">বাতিল</button>
          </div>
        </div>
      )}

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
