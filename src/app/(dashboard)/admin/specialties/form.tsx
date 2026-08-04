"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { saveSpecialty } from "@/actions/admin-content";
import { Field, inputCls, Toggle, Toast, MLInput } from "@/components/admin/ui";
import { IconPicker } from "@/components/admin/icon-picker";
import { type ML, emptyML } from "@/lib/utils";

export type SpecialtyDraft = {
  id?: number; slug: string; name: ML; icon: string; tint: number;
  intro: ML; meta_title: ML; meta_description: ML; active: boolean; sort: number;
};

export const EMPTY_SPECIALTY: SpecialtyDraft = {
  slug: "", name: { ...emptyML }, icon: "activity", tint: 0,
  intro: { ...emptyML }, meta_title: { ...emptyML }, meta_description: { ...emptyML },
  active: true, sort: 0,
};

export function SpecialtyForm({
    initial,
    onFinished,
}: {
    initial: SpecialtyDraft;
    onFinished: () => void;
}) {
    const [pending, startTransition] = useTransition();
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [draft, setDraft] = useState(initial);

    const submit = () => {
        startTransition(async () => {
            const res = await saveSpecialty(draft);
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
                {draft.id ? "বিভাগ এডিট" : "নতুন বিভাগ"}
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
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
                        <MLInput label="নাম" required value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Slug" hint="খালি রাখলে ইংরেজি নাম থেকে তৈরি হবে">
                            <input className={inputCls + " font-latin"} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
                            </Field>
                            <Field label="ক্রম">
                            <input type="number" className={inputCls} value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) || 0 })} />
                            </Field>
                        </div>
                        <Toggle checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="সক্রিয়" />
                    </div>
                    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
                        <Field label="আইকন">
                            <IconPicker value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
                        </Field>
                    </div>
                </div>

                <div className="rounded-2xl border border-line bg-white p-6">
                    <MLInput label="ভূমিকা (ল্যান্ডিং পেজের বর্ণনা)" textarea value={draft.intro} onChange={(v) => setDraft({ ...draft, intro: v })} />
                </div>
                
                <div className="rounded-2xl border border-line bg-white p-6">
                    <MLInput label="মেটা টাইটেল (SEO)" value={draft.meta_title} onChange={(v) => setDraft({ ...draft, meta_title: v })} />
                    <MLInput label="মেটা ডেসক্রিপশন (SEO)" value={draft.meta_description} onChange={(v) => setDraft({ ...draft, meta_description: v })} />
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
