"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSpecialty, deleteSpecialty } from "@/actions/admin-content";
import { Field, inputCls, Toggle, Toast, StatusBadge, ConfirmButton, MLInput } from "@/components/admin/ui";
import { toML, emptyML, type ML } from "@/lib/utils";
import { Icon, ICON_KEYS } from "@/components/icons";
import { bnNum } from "@/lib/bn";

export type SpecialtyRow = {
  id: number; slug: string; name: unknown; icon: string; tint: number;
  intro: unknown; meta_title: unknown; meta_description: unknown;
  active: boolean; sort: number; doctor_count: number;
};

type Draft = {
  id?: number; slug: string; name: ML; icon: string; tint: number;
  intro: ML; meta_title: ML; meta_description: ML; active: boolean; sort: number;
};

const EMPTY: Draft = {
  slug: "", name: { ...emptyML }, icon: "activity", tint: 0,
  intro: { ...emptyML }, meta_title: { ...emptyML }, meta_description: { ...emptyML },
  active: true, sort: 0,
};

export function SpecialtiesManager({ rows }: { rows: SpecialtyRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  const submit = () => {
    if (!editing) return;
    startTransition(async () => {
      const res = await saveSpecialty(editing);
      setResult(res);
      if (res.ok) { setEditing(null); router.refresh(); }
    });
  };

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setEditing({ ...EMPTY, sort: rows.length })}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + নতুন বিভাগ
        </button>
      </div>

      {editing && (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-white p-6">
          <div className="mb-4 font-heading text-base font-bold text-ink">
            {editing.id ? "বিভাগ এডিট" : "নতুন বিভাগ"}
          </div>
          <div className="flex flex-col gap-4">
            <MLInput label="নাম" required value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Slug" hint="খালি রাখলে ইংরেজি নাম থেকে তৈরি হবে">
                <input className={inputCls + " font-latin"} value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
              </Field>
              <Field label="ক্রম">
                <input type="number" className={inputCls} value={editing.sort} onChange={(e) => setEditing({ ...editing, sort: Number(e.target.value) || 0 })} />
              </Field>
            </div>
            <Field label="আইকন">
              <div className="mt-1 flex flex-wrap gap-2">
                {ICON_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEditing({ ...editing, icon: key })}
                    className={`flex h-10 w-10 items-center justify-center rounded-[10px] border ${
                      editing.icon === key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-white text-ink-faint"
                    }`}
                    aria-label={key}
                  >
                    <Icon name={key} size={20} />
                  </button>
                ))}
              </div>
            </Field>
            <MLInput label="ভূমিকা (ল্যান্ডিং পেজের বর্ণনা)" textarea value={editing.intro} onChange={(v) => setEditing({ ...editing, intro: v })} />
            <MLInput label="মেটা টাইটেল (SEO)" value={editing.meta_title} onChange={(v) => setEditing({ ...editing, meta_title: v })} />
            <MLInput label="মেটা ডেসক্রিপশন (SEO)" value={editing.meta_description} onChange={(v) => setEditing({ ...editing, meta_description: v })} />
            <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="সক্রিয়" />
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={submit} disabled={pending} className="rounded-[10px] bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-[10px] border border-line bg-white px-6 py-2.5 text-sm text-ink-mute">
              বাতিল
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              {["বিভাগ", "English", "Slug", "ডাক্তার", "স্ট্যাটাস", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3.5 text-right text-[12.5px] font-semibold text-ink-ghost">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const name = toML(s.name);
              return (
                <tr key={s.id}>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <div className="flex items-center gap-2.5 text-sm font-semibold text-ink">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <Icon name={s.icon} size={17} />
                      </span>
                      {name.bn}
                    </div>
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-mute">{name.en || "..."}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-faint">{s.slug}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{bnNum(s.doctor_count)}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <StatusBadge tone={s.active ? "green" : "gray"}>{s.active ? "সক্রিয়" : "নিষ্ক্রিয়"}</StatusBadge>
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditing({
                          id: s.id, slug: s.slug, name: toML(s.name), icon: s.icon, tint: s.tint,
                          intro: toML(s.intro), meta_title: toML(s.meta_title), meta_description: toML(s.meta_description),
                          active: s.active, sort: s.sort,
                        })}
                        className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                      >
                        এডিট
                      </button>
                      <ConfirmButton
                        onConfirm={() =>
                          startTransition(async () => {
                            const res = await deleteSpecialty(s.id);
                            setResult(res);
                            router.refresh();
                          })
                        }
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
