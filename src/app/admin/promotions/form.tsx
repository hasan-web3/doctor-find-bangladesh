"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { savePromotion } from "@/actions/admin-system";
import { Field, inputCls, Toast } from "@/components/admin/ui";

const PLAN_LABEL: Record<string, string> = { basic: "বেসিক", featured: "ফিচার্ড", premium: "প্রিমিয়াম" };
const PLAN_AMOUNT: Record<string, number> = { basic: 500, featured: 1500, premium: 3000 };

export type PromotionDraft = {
  id?: number; doctor_id: number | null; plan: string; amount: number;
  starts_on: string; ends_on: string; status: string; notes: string;
};

function monthLater(iso: string) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

const today = new Date().toISOString().slice(0, 10);

export const EMPTY_PROMOTION: PromotionDraft = {
    doctor_id: null, plan: "featured", amount: 1500, starts_on: today, ends_on: monthLater(today), status: "active", notes: ""
};

export function PromotionForm({
    initial,
    doctors,
    onFinished,
}: {
    initial: PromotionDraft;
    doctors: { id: number; name_bn: string }[];
    onFinished: () => void;
}) {
    const [pending, startTransition] = useTransition();
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [draft, setDraft] = useState(initial);

    const submit = () => {
        if (!draft.doctor_id) {
            setResult({ ok: false, message: "ডাক্তার নির্বাচন করুন" });
            return;
        }
        startTransition(async () => {
            const res = await savePromotion(draft);
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
                {draft.id ? "পেমেন্ট এডিট" : "নতুন পেমেন্ট"}
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
                        <Field label="ডাক্তার">
                        <select className={inputCls} value={draft.doctor_id ?? ""} onChange={(e) => setDraft({ ...draft, doctor_id: e.target.value ? Number(e.target.value) : null })}>
                            <option value="">নির্বাচন করুন</option>
                            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name_bn}</option>)}
                        </select>
                        </Field>
                        <Field label="প্ল্যান">
                        <select
                            className={inputCls}
                            value={draft.plan}
                            onChange={(e) => setDraft({ ...draft, plan: e.target.value, amount: PLAN_AMOUNT[e.target.value] ?? draft.amount })}
                        >
                            <option value="basic">বেসিক</option>
                            <option value="featured">ফিচার্ড</option>
                            <option value="premium">প্রিমিয়াম</option>
                        </select>
                        </Field>
                        <Field label="পরিমাণ (টাকা)">
                        <input type="number" className={inputCls} value={draft.amount || ""} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) || 0 })} />
                        </Field>
                        <Field label="শুরুর তারিখ">
                        <input type="date" className={inputCls + " font-latin"} value={draft.starts_on} onChange={(e) => setDraft({ ...draft, starts_on: e.target.value, ends_on: monthLater(e.target.value) })} />
                        </Field>
                        <Field label="মেয়াদ শেষ">
                        <input type="date" className={inputCls + " font-latin"} value={draft.ends_on} onChange={(e) => setDraft({ ...draft, ends_on: e.target.value })} />
                        </Field>
                        <Field label="স্ট্যাটাস">
                        <select className={inputCls} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                            <option value="active">সক্রিয়</option>
                            <option value="expired">মেয়াদ শেষ</option>
                            <option value="cancelled">বাতিল</option>
                        </select>
                        </Field>
                    </div>
                    <div className="mt-4">
                        <Field label="নোট (ঐচ্ছিক)">
                        <input className={inputCls} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="বিকাশ / নগদ / ক্যাশ..." />
                        </Field>
                    </div>
                    <div className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
                        ফিচার্ড বা প্রিমিয়াম প্ল্যানের সক্রিয় পেমেন্ট থাকলে ডাক্তার স্বয়ংক্রিয়ভাবে ফিচার্ড হবেন। মেয়াদ শেষ হলে ফিচার্ড ব্যাজ স্বয়ংক্রিয়ভাবে বন্ধ হবে।
                    </div>
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
