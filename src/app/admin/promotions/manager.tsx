"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePromotion, deletePromotion } from "@/actions/admin-system";
import { Field, inputCls, Toast, StatusBadge, ConfirmButton } from "@/components/admin/ui";
import { bnMoney, bnDate } from "@/lib/bn";

type Row = {
  id: number; doctor_id: number; doctor_bn: string; plan: string; amount: number;
  starts_on: string; ends_on: string; status: string; notes: string | null;
};

const PLAN_LABEL: Record<string, string> = { basic: "বেসিক", featured: "ফিচার্ড", premium: "প্রিমিয়াম" };
const PLAN_AMOUNT: Record<string, number> = { basic: 500, featured: 1500, premium: 3000 };

type Draft = {
  id?: number; doctor_id: number | null; plan: string; amount: number;
  starts_on: string; ends_on: string; status: string; notes: string;
};

function monthLater(iso: string) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function PromotionsManager({ rows, doctors }: { rows: Row[]; doctors: { id: number; name_bn: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const submit = () => {
    if (!editing || !editing.doctor_id) {
      setResult({ ok: false, message: "ডাক্তার নির্বাচন করুন" });
      return;
    }
    startTransition(async () => {
      const res = await savePromotion(editing);
      setResult(res);
      if (res.ok) { setEditing(null); router.refresh(); }
    });
  };

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex items-center justify-between">
        <div className="font-heading text-[17px] font-bold text-ink">পেমেন্ট রেকর্ড</div>
        <button
          onClick={() => setEditing({ doctor_id: null, plan: "featured", amount: 1500, starts_on: today, ends_on: monthLater(today), status: "active", notes: "" })}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + পেমেন্ট যুক্ত করুন
        </button>
      </div>

      {editing && (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="ডাক্তার">
              <select className={inputCls} value={editing.doctor_id ?? ""} onChange={(e) => setEditing({ ...editing, doctor_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">নির্বাচন করুন</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name_bn}</option>)}
              </select>
            </Field>
            <Field label="প্ল্যান">
              <select
                className={inputCls}
                value={editing.plan}
                onChange={(e) => setEditing({ ...editing, plan: e.target.value, amount: PLAN_AMOUNT[e.target.value] ?? editing.amount })}
              >
                <option value="basic">বেসিক</option>
                <option value="featured">ফিচার্ড</option>
                <option value="premium">প্রিমিয়াম</option>
              </select>
            </Field>
            <Field label="পরিমাণ (টাকা)">
              <input type="number" className={inputCls} value={editing.amount || ""} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="শুরুর তারিখ">
              <input type="date" className={inputCls + " font-latin"} value={editing.starts_on} onChange={(e) => setEditing({ ...editing, starts_on: e.target.value, ends_on: monthLater(e.target.value) })} />
            </Field>
            <Field label="মেয়াদ শেষ">
              <input type="date" className={inputCls + " font-latin"} value={editing.ends_on} onChange={(e) => setEditing({ ...editing, ends_on: e.target.value })} />
            </Field>
            <Field label="স্ট্যাটাস">
              <select className={inputCls} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                <option value="active">সক্রিয়</option>
                <option value="expired">মেয়াদ শেষ</option>
                <option value="cancelled">বাতিল</option>
              </select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="নোট (ঐচ্ছিক)">
              <input className={inputCls} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="বিকাশ / নগদ / ক্যাশ..." />
            </Field>
          </div>
          <div className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-[13px] text-brand-700">
            ফিচার্ড বা প্রিমিয়াম প্ল্যানের সক্রিয় পেমেন্ট থাকলে ডাক্তার স্বয়ংক্রিয়ভাবে ফিচার্ড হবেন। মেয়াদ শেষ হলে ফিচার্ড ব্যাজ স্বয়ংক্রিয়ভাবে বন্ধ হবে।
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={submit} disabled={pending} className="rounded-[10px] bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-[10px] border border-line bg-white px-6 py-2.5 text-sm text-ink-mute">বাতিল</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr>
              {["ডাক্তার", "প্ল্যান", "পরিমাণ", "শুরু", "মেয়াদ শেষ", "স্ট্যাটাস", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3 text-left text-[12.5px] font-semibold text-ink-ghost">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">{p.doctor_bn}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{PLAN_LABEL[p.plan]}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">{bnMoney(p.amount)}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-faint">{bnDate(p.starts_on)}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-faint">{bnDate(p.ends_on)}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                  <StatusBadge tone={p.status === "active" ? "green" : p.status === "expired" ? "red" : "gray"}>
                    {p.status === "active" ? "সক্রিয়" : p.status === "expired" ? "মেয়াদ শেষ" : "বাতিল"}
                  </StatusBadge>
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setEditing({
                        id: p.id, doctor_id: p.doctor_id, plan: p.plan, amount: p.amount,
                        starts_on: p.starts_on, ends_on: p.ends_on, status: p.status, notes: p.notes || "",
                      })}
                      className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                    >
                      এডিট
                    </button>
                    <ConfirmButton
                      onConfirm={() =>
                        startTransition(async () => {
                          const res = await deletePromotion(p.id);
                          setResult(res);
                          router.refresh();
                        })
                      }
                    />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-ghost">কোনো পেমেন্ট রেকর্ড নেই।</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
