"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { saveTestimonial } from "@/actions/admin-content";
import { Field, inputCls, Toggle, Toast, ImageUpload, MLInput } from "@/components/admin/ui";
import { type ML, emptyML } from "@/lib/utils";

export type TestimonialDraft = {
  id?: number; name: string; area_text: ML; quote: ML; published: boolean; sort: number; photo_url: string | null;
};

export const EMPTY_TESTIMONIAL: TestimonialDraft = {
    name: "", area_text: { ...emptyML }, quote: { ...emptyML }, published: true, sort: 0, photo_url: null
};

export function TestimonialForm({
    initial,
    onFinished,
}: {
    initial: TestimonialDraft;
    onFinished: () => void;
}) {
    const [pending, startTransition] = useTransition();
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [draft, setDraft] = useState(initial);
    const [photoData, setPhotoData] = useState<string | undefined>();
    const [removePhoto, setRemovePhoto] = useState(false);

    const submit = () => {
        startTransition(async () => {
            const res = await saveTestimonial({ ...draft, photo_data: photoData, remove_photo: removePhoto });
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
                {draft.id ? "মতামত এডিট" : "নতুন মতামত"}
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
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
                    <ImageUpload
                    currentUrl={removePhoto ? null : draft.photo_url}
                    label="ছবি"
                    onChange={(data) => { setPhotoData(data); setRemovePhoto(false); }}
                    onRemove={() => { setPhotoData(undefined); setRemovePhoto(true); }}
                    />
                    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
                        <Field label="নাম">
                            <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                        </Field>
                        <MLInput label="এলাকা" value={draft.area_text} onChange={(v) => setDraft({ ...draft, area_text: v })} />
                        <Toggle checked={draft.published} onChange={(v) => setDraft({ ...draft, published: v })} label="প্রকাশিত" />
                    </div>
                </div>
                <div className="rounded-2xl border border-line bg-white p-6">
                    <MLInput label="মতামত" required textarea value={draft.quote} onChange={(v) => setDraft({ ...draft, quote: v })} />
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
