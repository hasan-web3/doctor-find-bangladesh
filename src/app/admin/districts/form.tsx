"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { saveDistrict } from "@/actions/admin-content";
import { Field, inputCls, Toggle, Toast, MLInput } from "@/components/admin/ui";
import { type ML, emptyML } from "@/lib/utils";

export type DistrictDraft = {
  id?: number; slug: string; name: ML; lat: string; lng: string;
  intro: ML; meta_title: ML; meta_description: ML; active: boolean; sort: number;
};

export const EMPTY_DISTRICT: DistrictDraft = {
  slug: "", name: { ...emptyML }, lat: "", lng: "",
  intro: { ...emptyML }, meta_title: { ...emptyML }, meta_description: { ...emptyML },
  active: true, sort: 0,
};

export function DistrictForm({
    initial,
    onFinished,
}: {
    initial: DistrictDraft;
    onFinished: () => void;
}) {
    const [pending, startTransition] = useTransition();
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [draft, setDraft] = useState(initial);

    const submit = () => {
        startTransition(async () => {
            const res = await saveDistrict({
                ...draft,
                lat: draft.lat === "" ? null : Number(draft.lat),
                lng: draft.lng === "" ? null : Number(draft.lng),
            });
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
                {draft.id ? "জেলা এডিট" : "নতুন জেলা"}
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
                        <MLInput label="নাম" required value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} hint="ইংরেজি নাম URL ও IP জিও-ম্যাচিংয়ে ব্যবহৃত হয়" />
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Slug" hint="খালি রাখলে ইংরেজি নাম থেকে তৈরি হবে">
                            <input className={inputCls + " font-latin"} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
                            </Field>
                            <Field label="ক্রম">
                            <input type="number" className={inputCls} value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) || 0 })} />
                            </Field>
                            <Field label="অক্ষাংশ (lat)">
                            <input className={inputCls + " font-latin"} value={draft.lat} onChange={(e) => setDraft({ ...draft, lat: e.target.value })} placeholder="22.8456" />
                            </Field>
                            <Field label="দ্রাঘিমাংশ (lng)">
                            <input className={inputCls + " font-latin"} value={draft.lng} onChange={(e) => setDraft({ ...draft, lng: e.target.value })} placeholder="89.5403" />
                            </Field>
                        </div>
                        <div className="mt-4">
                            <Toggle checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="সক্রিয়" />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-line bg-white p-6">
                        <MLInput label="ভূমিকা" textarea value={draft.intro} onChange={(v) => setDraft({ ...draft, intro: v })} />
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
