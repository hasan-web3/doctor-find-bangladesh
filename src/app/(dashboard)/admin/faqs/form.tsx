"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { saveFaq } from "@/actions/admin-content";
import { Field, inputCls, Toggle, Toast, MLInput } from "@/components/admin/ui";
import { type ML, emptyML } from "@/lib/utils";
import { scopeLabel } from "./scopes";

export type FaqDraft = {
  id?: number; scope: string; ref_id: number | null; question: ML; answer: ML; sort: number; active: boolean;
  /**
   * Present when this draft came from a GENERATED FAQ. Saving carries it
   * through so the row overrides that specific generated answer instead of
   * becoming a second, duplicate FAQ next to it.
   */
  auto_key?: string | null;
};

// Scope and ref_id come from the page's URL, so a draft is always created
// already filed under the right entity. There is no scope <select> and no
// entity <select> in this form any more — those two dropdowns were what forced
// the screen to load every specialty, area, hospital and doctor up front.
export function emptyFaq(scope: string, refId: number | null, sort = 0): FaqDraft {
  return { scope, ref_id: refId, question: { ...emptyML }, answer: { ...emptyML }, sort, active: true };
}

export function FaqForm({
    initial,
    refLabel,
    onFinished,
}: {
    initial: FaqDraft;
    /** Read-only name of what this FAQ is filed under, e.g. "খুলনা". */
    refLabel: string;
    onFinished: () => void;
}) {
    const [pending, startTransition] = useTransition();
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [draft, setDraft] = useState(initial);

    const submit = () => {
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
                            <Field label="কোথায় দেখাবে">
                              {/* Fixed by the page you came from, shown so there is
                                  never any doubt about where this FAQ will appear. */}
                              <div className="flex h-[42px] items-center rounded-[10px] border border-line bg-page px-3 text-sm font-semibold text-ink">
                                {scopeLabel(draft.scope)}
                                {draft.ref_id !== null ? `: ${refLabel}` : ""}
                              </div>
                            </Field>
                            <Field label="ক্রম" hint="ছোট সংখ্যা আগে দেখাবে">
                              <input type="number" className={inputCls} value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) || 0 })} />
                            </Field>
                            <Field label="অবস্থা">
                              <div className="flex h-[42px] items-center">
                                <Toggle checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="সক্রিয়" />
                              </div>
                            </Field>
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
