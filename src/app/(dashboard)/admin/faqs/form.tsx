"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { saveFaq } from "@/actions/admin-content";
import { Field, inputCls, Toggle, Toast, MLInput } from "@/components/admin/ui";
import { type ML, emptyML } from "@/lib/utils";

const SCOPES = [
  ["home", "হোমপেজ"], ["specialty", "বিভাগ"], ["area", "থানা / উপজেলা"], ["hospital", "হাসপাতাল"], ["doctor", "ডাক্তার"],
] as const;

type Opt = { id: number; name_bn: string };
type Refs = { specialty: Opt[]; area: Opt[]; hospital: Opt[]; doctor: Opt[] };

export type FaqDraft = {
  id?: number; scope: string; ref_id: number | null; question: ML; answer: ML; sort: number; active: boolean;
};

export const EMPTY_FAQ: FaqDraft = {
    scope: "home", ref_id: null, question: { ...emptyML }, answer: { ...emptyML }, sort: 0, active: true
};

export function FaqForm({
    initial,
    refs,
    onFinished,
}: {
    initial: FaqDraft;
    refs: Refs;
    onFinished: () => void;
}) {
    const [pending, startTransition] = useTransition();
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [draft, setDraft] = useState(initial);

    const submit = () => {
        if (draft.scope !== "home" && !draft.ref_id) {
            setResult({ ok: false, message: "কোন পেজে দেখাবে তা নির্বাচন করুন" });
            return;
        }
        startTransition(async () => {
            const res = await saveFaq(draft);
            setResult(res);
            if (res.ok) {
                onFinished();
            }
        });
    };

    return (
        <div className="relative">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white p-4 sm:p-5">
              <h2 className="font-heading text-xl font-bold text-ink">
                {draft.id ? "FAQ এডিট" : "নতুন FAQ"}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onFinished}
                  className="rounded-[10px] border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-mute hover:bg-slate-50 transition-colors"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending}
                  className="rounded-[10px] bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
                >
                  {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
                </button>
                <div className="h-6 w-px bg-line mx-1" />
                <button
                  type="button"
                  onClick={onFinished}
                  aria-label="Close"
                  className="rounded-full p-2 text-ink-ghost transition-colors hover:bg-slate-100 hover:text-ink"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Scrollable form content */}
            <div className="p-6 pb-28">
              <Toast result={result} />
                <div className="flex flex-col gap-5">
                    <div className="rounded-2xl border border-line bg-white p-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <Field label="স্কোপ">
                            <select className={inputCls} value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value, ref_id: null })}>
                                {SCOPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                            </Field>
                            {draft.scope !== "home" && (
                            <Field label="কোন পেজে">
                                <select className={inputCls} value={draft.ref_id ?? ""} onChange={(e) => setDraft({ ...draft, ref_id: e.target.value ? Number(e.target.value) : null })}>
                                <option value="">নির্বাচন করুন</option>
                                {(refs[draft.scope as keyof Refs] || []).map((o) => <option key={o.id} value={o.id}>{o.name_bn}</option>)}
                                </select>
                            </Field>
                            )}
                            <Field label="ক্রম">
                            <input type="number" className={inputCls} value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) || 0 })} />
                            </Field>
                        </div>
                        <div className="mt-4">
                            <Toggle checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="সক্রিয়" />
                        </div>
                    </div>
                    <div className="rounded-2xl border border-line bg-white p-6">
                        <MLInput label="প্রশ্ন" required value={draft.question} onChange={(v) => setDraft({ ...draft, question: v })} />
                    </div>
                    <div className="rounded-2xl border border-line bg-white p-6">
                        <MLInput label="উত্তর" required textarea value={draft.answer} onChange={(v) => setDraft({ ...draft, answer: v })} />
                    </div>
                </div>
            </div>
            
            {/* Sticky Footer */}
            <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-line bg-white/80 p-4 backdrop-blur-sm">
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onFinished}
                        className="rounded-[10px] border border-line bg-white px-6 py-3 text-[14.5px] font-semibold text-ink-mute"
                    >
                        বাতিল
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={pending}
                        className="rounded-[10px] bg-brand-600 px-6 py-3 text-[14.5px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                        {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
                    </button>
                </div>
            </div>
        </div>
    );
}
