"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { saveSlide } from "@/actions/admin-content";
import { Field, inputCls, Toggle, Toast, ImageUpload, MLInput } from "@/components/admin/ui";
import { type ML, emptyML } from "@/lib/utils";
import { Icon, ICON_KEYS } from "@/components/icons";

export type SlideDraft = {
  id?: number; title: ML; text: ML; icon: string;
  cta_label: ML; cta_href: string; sort: number; active: boolean; image_url: string | null;
};

export const EMPTY_SLIDE: SlideDraft = {
    title: { ...emptyML }, text: { ...emptyML }, icon: "shield", cta_label: { ...emptyML }, cta_href: "", sort: 0, active: true, image_url: null
};

export function SlideForm({
    initial,
    onFinished,
}: {
    initial: SlideDraft;
    onFinished: () => void;
}) {
    const [pending, startTransition] = useTransition();
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [draft, setDraft] = useState(initial);
    const [imageData, setImageData] = useState<string | undefined>();
    const [removeImage, setRemoveImage] = useState(false);

    const submit = () => {
        startTransition(async () => {
            const res = await saveSlide({ ...draft, image_data: imageData, remove_image: removeImage });
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
                {draft.id ? "স্লাইড এডিট" : "নতুন স্লাইড"}
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
                    currentUrl={removeImage ? null : draft.image_url}
                    label="স্লাইড ছবি"
                    aspect="aspect-[4/5]"
                    onChange={(data) => { setImageData(data); setRemoveImage(false); }}
                    onRemove={() => { setImageData(undefined); setRemoveImage(true); }}
                    />
                    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
                        <MLInput label="শিরোনাম" required value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
                        <MLInput label="বিবরণ" value={draft.text} onChange={(v) => setDraft({ ...draft, text: v })} />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <MLInput label="বাটন লেবেল (ঐচ্ছিক)" value={draft.cta_label} onChange={(v) => setDraft({ ...draft, cta_label: v })} />
                            <div className="grid grid-cols-1 gap-4">
                            <Field label="বাটন লিংক (ঐচ্ছিক)">
                                <input className={inputCls + " font-latin"} value={draft.cta_href} onChange={(e) => setDraft({ ...draft, cta_href: e.target.value })} placeholder="/doctors" />
                            </Field>
                            <Field label="ক্রম">
                                <input type="number" className={inputCls} value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) || 0 })} />
                            </Field>
                            </div>
                        </div>
                        <Toggle checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="সক্রিয়" />
                    </div>
                </div>
                <div className="rounded-2xl border border-line bg-white p-6">
                    <Field label="আইকন">
                        <div className="flex flex-wrap gap-2">
                        {ICON_KEYS.slice(0, 16).map((key) => (
                            <button
                            key={key}
                            type="button"
                            onClick={() => setDraft({ ...draft, icon: key })}
                            className={`flex h-9 w-9 items-center justify-center rounded-[9px] border ${
                                draft.icon === key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-white text-ink-faint"
                            }`}
                            >
                            <Icon name={key} size={18} />
                            </button>
                        ))}
                        </div>
                    </Field>
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
