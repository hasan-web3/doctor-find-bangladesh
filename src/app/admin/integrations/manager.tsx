"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveIntegrationAction, testIntegrationAction } from "@/actions/admin-system";
import type { IntegrationKey } from "@/lib/integrations";
import { Field, inputCls, Toggle, StatusBadge } from "@/components/admin/ui";
import { bnDateTime } from "@/lib/bn";

export type IntegrationView = {
  key: IntegrationKey;
  label_bn: string;
  desc_bn: string;
  fields: { name: string; label_bn: string; secret?: boolean; placeholder?: string }[];
  enabled: boolean;
  status: "never" | "ok" | "failed";
  status_message: string | null;
  last_tested_at: string | null;
  config: Record<string, string>;
};

function Card({ item }: { item: IntegrationView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(item.enabled);
  const [config, setConfig] = useState(item.config);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Masked secrets that the admin didn't retype keep their stored value.
  const effectiveConfig = () => {
    const out: Record<string, string> = {};
    for (const f of item.fields) {
      const v = config[f.name] ?? "";
      out[f.name] = f.secret && v === "••••••••" ? "__KEEP__" : v;
    }
    return out;
  };

  const save = () =>
    startTransition(async () => {
      // "__KEEP__" markers are resolved server-side to the stored secret values.
      const res = await saveIntegrationAction(item.key, enabled, effectiveConfig());
      setMessage({ ok: res.ok, text: res.message });
      router.refresh();
    });

  const test = () =>
    startTransition(async () => {
      const res = await testIntegrationAction(item.key, effectiveConfig());
      setMessage({ ok: res.ok, text: res.message });
      router.refresh();
    });

  return (
    <div className="rounded-2xl border border-line bg-white">
      <button onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-3 p-5 text-right">
        <div className="min-w-[180px] flex-1">
          <div className="flex items-center gap-2.5">
            <span className="font-heading text-[15.5px] font-bold text-ink">{item.label_bn}</span>
            {item.status === "ok" && <StatusBadge tone="green">সংযুক্ত</StatusBadge>}
            {item.status === "failed" && <StatusBadge tone="red">ব্যর্থ</StatusBadge>}
            {item.status === "never" && <StatusBadge tone="gray">টেস্ট হয়নি</StatusBadge>}
            {item.enabled ? <StatusBadge tone="blue">চালু</StatusBadge> : null}
          </div>
          <div className="mt-0.5 text-[13px] text-ink-faint">{item.desc_bn}</div>
        </div>
        <span className="text-ink-ghost">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-line p-5">
          <div className="mb-4">
            <Toggle checked={enabled} onChange={setEnabled} label="ইন্টিগ্রেশন চালু করুন" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {item.fields.map((f) => (
              <Field key={f.name} label={f.label_bn} hint={f.secret ? "পরিবর্তন করতে নতুন মান লিখুন" : undefined}>
                <input
                  type={f.secret ? "password" : "text"}
                  className={inputCls + " font-latin"}
                  value={config[f.name] || ""}
                  placeholder={f.placeholder}
                  onChange={(e) => setConfig({ ...config, [f.name]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          {message && (
            <div className={`mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold ${message.ok ? "bg-accent-soft text-accent-text" : "bg-[#FEF2F2] text-[#DC2626]"}`}>
              {message.text}
            </div>
          )}
          {item.last_tested_at && (
            <div className="mt-2 text-xs text-ink-ghost">সর্বশেষ টেস্ট: {bnDateTime(item.last_tested_at)}</div>
          )}
          <div className="mt-4 flex gap-3">
            <button onClick={save} disabled={pending} className="rounded-[10px] bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {pending ? "..." : "সংরক্ষণ করুন"}
            </button>
            <button onClick={test} disabled={pending} className="rounded-[10px] border border-brand-600 bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 disabled:opacity-60">
              সংযোগ টেস্ট করুন
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function IntegrationsManager({ items }: { items: IntegrationView[] }) {
  return (
    <div className="flex max-w-[760px] flex-col gap-4">
      {items.map((item) => (
        <Card key={item.key} item={item} />
      ))}
    </div>
  );
}
