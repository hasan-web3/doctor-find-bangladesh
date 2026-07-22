"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveReview, toggleReview, deleteReview } from "@/actions/admin-content";
import { Field, inputCls, Toggle, Toast, StatusBadge, ConfirmButton } from "@/components/admin/ui";
import { bnDate } from "@/lib/bn";

type Review = {
  id: number; doctor_id: number; doctor_bn: string; name: string; area_text: string | null;
  body: string | null; published: boolean; created_at: string;
};

type Draft = {
  id?: number; doctor_id: number | null; name: string; area_text: string; body: string; published: boolean;
};

export function ReviewsManager({ reviews, doctors }: { reviews: Review[]; doctors: { id: number; name_bn: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  const submit = () => {
    if (!editing?.doctor_id) { setResult({ ok: false, message: "ডাক্তার নির্বাচন করুন" }); return; }
    startTransition(async () => {
      const res = await saveReview({ ...editing, doctor_id: editing.doctor_id! });
      setResult(res);
      if (res.ok) { setEditing(null); router.refresh(); }
    });
  };

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setEditing({ doctor_id: null, name: "", area_text: "", body: "", published: true })}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + রিভিউ যোগ করুন
        </button>
      </div>

      {editing && (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ডাক্তার">
              <select className={inputCls} value={editing.doctor_id ?? ""} onChange={(e) => setEditing({ ...editing, doctor_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">নির্বাচন করুন</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name_bn}</option>)}
              </select>
            </Field>
            <Field label="রোগীর নাম">
              <input className={inputCls} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="এলাকা">
              <input className={inputCls} value={editing.area_text} onChange={(e) => setEditing({ ...editing, area_text: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="রিভিউ">
              <textarea rows={3} className={inputCls + " resize-y font-body"} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4">
            <Toggle checked={editing.published} onChange={(v) => setEditing({ ...editing, published: v })} label="প্রকাশিত" />
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
        {reviews.map((r) => (
          <div key={r.id} className="flex flex-wrap items-start gap-3.5 rounded-[14px] border border-line bg-white p-[18px]">
            <div className="min-w-[220px] flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2.5">
                <span className="text-[15px] font-bold text-ink">{r.name}</span>
                <StatusBadge tone={r.published ? "green" : "amber"}>{r.published ? "প্রকাশিত" : "অপেক্ষমাণ"}</StatusBadge>
              </div>
              <div className="text-[13px] text-ink-faint">
                {r.doctor_bn} · {r.area_text || ""} · {bnDate(r.created_at)}
              </div>
              {r.body && <p className="mb-0 mt-1.5 text-sm text-ink-mute">{r.body}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  startTransition(async () => {
                    await toggleReview(r.id, !r.published);
                    router.refresh();
                  })
                }
                className={`rounded-[9px] px-3.5 py-2 text-[13px] font-bold ${r.published ? "border border-line bg-white text-ink-mute" : "bg-accent text-white"}`}
              >
                {r.published ? "আনপাবলিশ" : "প্রকাশ করুন"}
              </button>
              <button
                onClick={() => setEditing({
                  id: r.id, doctor_id: r.doctor_id, name: r.name, area_text: r.area_text || "",
                  body: r.body || "", published: r.published,
                })}
                className="rounded-[9px] border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-600"
              >
                এডিট
              </button>
              <ConfirmButton
                onConfirm={() =>
                  startTransition(async () => {
                    await deleteReview(r.id);
                    router.refresh();
                  })
                }
              />
            </div>
          </div>
        ))}
        {reviews.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-sm text-ink-ghost">কোনো রিভিউ নেই।</div>
        )}
      </div>
    </div>
  );
}
