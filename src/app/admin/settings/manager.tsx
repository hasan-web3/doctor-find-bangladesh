"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettings, sendTestEmail } from "@/actions/admin-system";
import { Field, inputCls, Toast, MLInput, Toggle } from "@/components/admin/ui";
import { type ML } from "@/lib/utils";

type Basic = {
  brand_name: ML; helpline: string; helpline_bn: string; whatsapp: string; email: string;
  address: ML; facebook: string; youtube: string; instagram: string; logo_url: string;
  // Controls whether the /for-doctors page renders the promotion plan cards.
  // When off, the page shows only the lead form (still lets doctors sign up).
  show_plans: boolean;
};

type PlanDraft = { key: string; name: ML; price: number; period: ML; popular: boolean; feats: ML[] };
type StatDraft = { value: number; suffix: string; label: ML };

export function SettingsManager({
  initial,
  plans: initialPlans,
  stats: initialStats,
}: {
  initial: Basic;
  plans: PlanDraft[];
  stats: StatDraft[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [form, setForm] = useState(initial);
  const [plans, setPlans] = useState(initialPlans);
  const [stats, setStats] = useState(initialStats);

  const save = (entries: Record<string, unknown>) =>
    startTransition(async () => {
      const res = await saveSettings(entries);
      setResult(res);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6">
      <Toast result={result} />

      {/* basic info */}
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="mb-4 font-heading text-base font-bold text-ink">সাধারণ তথ্য</div>
        <div className="flex flex-col gap-4">
          <MLInput label="ব্র্যান্ড নাম" required value={form.brand_name} onChange={(v) => setForm({ ...form, brand_name: v })} />
          <MLInput label="ঠিকানা" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ইমেইল">
              <input className={inputCls + " font-latin"} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="হোয়াটসঅ্যাপ নম্বর" hint="দেশের কোডসহ, যেমন 8801774739914">
              <input className={inputCls + " font-latin"} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </Field>
            <Field label="হেল্পলাইন নম্বর (ইংরেজি সংখ্যায়)" hint="কল লিংকে ব্যবহৃত হয়">
              <input className={inputCls + " font-latin"} value={form.helpline} onChange={(e) => setForm({ ...form, helpline: e.target.value })} placeholder="01774739914" />
            </Field>
            <Field label="হেল্পলাইন নম্বর (বাংলায় প্রদর্শনের জন্য)">
              <input className={inputCls} value={form.helpline_bn} onChange={(e) => setForm({ ...form, helpline_bn: e.target.value })} placeholder="০১৭৭৪৭৩৯৯১৪" />
            </Field>
            <Field label="ফেসবুক লিংক">
              <input className={inputCls + " font-latin"} value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} placeholder="https://facebook.com/..." />
            </Field>
            <Field label="ইউটিউব লিংক">
              <input className={inputCls + " font-latin"} value={form.youtube} onChange={(e) => setForm({ ...form, youtube: e.target.value })} placeholder="https://youtube.com/..." />
            </Field>
            <Field label="ইনস্টাগ্রাম লিংক">
              <input className={inputCls + " font-latin"} value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
            </Field>
            <Field label="লোগো URL (ঐচ্ছিক)">
              <input className={inputCls + " font-latin"} value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={() => save(form)} disabled={pending} className="rounded-[10px] bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {pending ? "সংরক্ষণ হচ্ছে..." : "সেটিংস সংরক্ষণ করুন"}
          </button>
          <button
            onClick={() => startTransition(async () => setResult(await sendTestEmail()))}
            disabled={pending}
            className="rounded-[10px] border border-line bg-white px-5 py-2.5 text-sm text-ink-mute disabled:opacity-60"
          >
            টেস্ট ইমেইল পাঠান
          </button>
        </div>
      </div>

      {/* homepage stats */}
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="mb-4 font-heading text-base font-bold text-ink">হোমপেজ পরিসংখ্যান</div>
        <div className="flex flex-col gap-4">
          {stats.map((s, i) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <div className="mb-2 grid grid-cols-2 gap-2">
                <Field label="সংখ্যা">
                  <input
                    type="number"
                    className={inputCls}
                    value={s.value}
                    onChange={(e) => setStats(stats.map((x, xi) => (xi === i ? { ...x, value: Number(e.target.value) || 0 } : x)))}
                  />
                </Field>
                <Field label="সাফিক্স (যেমন: +)">
                  <input
                    className={inputCls}
                    value={s.suffix}
                    onChange={(e) => setStats(stats.map((x, xi) => (xi === i ? { ...x, suffix: e.target.value } : x)))}
                  />
                </Field>
              </div>
              <MLInput
                label="লেবেল"
                value={s.label}
                onChange={(v) => setStats(stats.map((x, xi) => (xi === i ? { ...x, label: v } : x)))}
              />
            </div>
          ))}
        </div>
        <button onClick={() => save({ stats })} disabled={pending} className="mt-4 rounded-[10px] bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
          পরিসংখ্যান সংরক্ষণ করুন
        </button>
      </div>

      {/* plans */}
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 font-heading text-base font-bold text-ink">প্রমোশন প্ল্যান</div>
            <p className="m-0 text-[13px] text-ink-faint">
              ডাক্তারদের জন্য পেজে প্রদর্শিত প্ল্যান ও মূল্য। Toggle বন্ধ করলে <code className="font-latin">/for-doctors</code> পেজে শুধু যোগাযোগ ফর্ম থাকবে, প্ল্যানগুলো লুকিয়ে যাবে।
            </p>
          </div>
          {/* Visibility toggle — persists alongside the basic-info save on the
              same "সেটিংস সংরক্ষণ করুন" button below, so admins don't have to
              track two save actions for the plans section. */}
          <div className="shrink-0 rounded-xl border border-line bg-page px-4 py-3">
            <Toggle
              checked={form.show_plans}
              onChange={(v) => {
                setForm({ ...form, show_plans: v });
                save({ ...form, show_plans: v });
              }}
              label={form.show_plans ? "ফ্রন্টএন্ডে প্রদর্শন চালু" : "ফ্রন্টএন্ডে লুকানো"}
            />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {plans.map((p, i) => (
            <div key={p.key} className="rounded-xl border border-line p-4">
              <div className="flex flex-col gap-3">
                <MLInput label="নাম" value={p.name} onChange={(v) => setPlans(plans.map((x, xi) => (xi === i ? { ...x, name: v } : x)))} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="মূল্য (টাকা/মাস)">
                    <input type="number" className={inputCls} value={p.price} onChange={(e) => setPlans(plans.map((x, xi) => (xi === i ? { ...x, price: Number(e.target.value) || 0 } : x)))} />
                  </Field>
                  <Field label="জনপ্রিয় ব্যাজ">
                    <select className={inputCls} value={p.popular ? "1" : "0"} onChange={(e) => setPlans(plans.map((x, xi) => (xi === i ? { ...x, popular: e.target.value === "1" } : x)))}>
                      <option value="0">না</option>
                      <option value="1">হ্যাঁ</option>
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="সুবিধাসমূহ, বাংলা (প্রতি লাইনে একটি)">
                    <textarea
                      rows={4}
                      className={inputCls + " resize-y font-body"}
                      value={p.feats.map((f) => f.bn).join("\n")}
                      onChange={(e) => {
                        const bnLines = e.target.value.split("\n");
                        setPlans(plans.map((x, xi) => (xi === i
                          ? { ...x, feats: bnLines.map((bn, li) => ({ bn, en: x.feats[li]?.en || "" })) }
                          : x)));
                      }}
                    />
                  </Field>
                  <Field label="Benefits, English (one per line, optional)">
                    <textarea
                      rows={4}
                      className={inputCls + " resize-y font-latin"}
                      value={p.feats.map((f) => f.en).join("\n")}
                      onChange={(e) => {
                        const enLines = e.target.value.split("\n");
                        setPlans(plans.map((x, xi) => (xi === i
                          ? { ...x, feats: x.feats.map((f, li) => ({ ...f, en: enLines[li] || "" })) }
                          : x)));
                      }}
                    />
                  </Field>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => save({ plans: plans.map((p) => ({ ...p, feats: p.feats.filter((f) => f.bn.trim()) })) })}
          disabled={pending}
          className="mt-4 rounded-[10px] bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          প্ল্যান সংরক্ষণ করুন
        </button>
      </div>
    </div>
  );
}
