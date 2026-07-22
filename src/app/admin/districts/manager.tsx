"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDistrict, deleteDistrict } from "@/actions/admin-content";
import { Field, inputCls, Toggle, Toast, StatusBadge, ConfirmButton, MLInput } from "@/components/admin/ui";
import { toML, emptyML, type ML } from "@/lib/utils";
import { bnNum } from "@/lib/bn";

export type DistrictRow = {
  id: number; slug: string; name: unknown;
  lat: number | null; lng: number | null; intro: unknown;
  meta_title: unknown; meta_description: unknown; active: boolean; sort: number; area_count: number;
};

type Draft = {
  id?: number; slug: string; name: ML; lat: string; lng: string;
  intro: ML; meta_title: ML; meta_description: ML; active: boolean; sort: number;
};

const EMPTY: Draft = {
  slug: "", name: { ...emptyML }, lat: "", lng: "",
  intro: { ...emptyML }, meta_title: { ...emptyML }, meta_description: { ...emptyML },
  active: true, sort: 0,
};

export function DistrictsManager({ rows }: { rows: DistrictRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  const submit = () => {
    if (!editing) return;
    startTransition(async () => {
      const res = await saveDistrict({
        ...editing,
        lat: editing.lat === "" ? null : Number(editing.lat),
        lng: editing.lng === "" ? null : Number(editing.lng),
      });
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
          + নতুন জেলা
        </button>
      </div>

      {editing && (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-white p-6">
          <div className="mb-4 font-heading text-base font-bold text-ink">{editing.id ? "জেলা এডিট" : "নতুন জেলা"}</div>
          <div className="flex flex-col gap-4">
            <MLInput label="নাম" required value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} hint="ইংরেজি নাম URL ও IP জিও-ম্যাচিংয়ে ব্যবহৃত হয়" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Slug" hint="খালি রাখলে ইংরেজি নাম থেকে তৈরি হবে">
                <input className={inputCls + " font-latin"} value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
              </Field>
              <Field label="ক্রম">
                <input type="number" className={inputCls} value={editing.sort} onChange={(e) => setEditing({ ...editing, sort: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="অক্ষাংশ (lat)">
                <input className={inputCls + " font-latin"} value={editing.lat} onChange={(e) => setEditing({ ...editing, lat: e.target.value })} placeholder="22.8456" />
              </Field>
              <Field label="দ্রাঘিমাংশ (lng)">
                <input className={inputCls + " font-latin"} value={editing.lng} onChange={(e) => setEditing({ ...editing, lng: e.target.value })} placeholder="89.5403" />
              </Field>
            </div>
            <MLInput label="ভূমিকা" textarea value={editing.intro} onChange={(v) => setEditing({ ...editing, intro: v })} />
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
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr>
              {["জেলা", "English", "Slug", "এলাকা", "স্ট্যাটাস", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3.5 text-right text-[12.5px] font-semibold text-ink-ghost">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const name = toML(d.name);
              return (
                <tr key={d.id}>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">{name.bn}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-mute">{name.en || "..."}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-faint">{d.slug}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{bnNum(d.area_count)}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <StatusBadge tone={d.active ? "green" : "gray"}>{d.active ? "সক্রিয়" : "নিষ্ক্রিয়"}</StatusBadge>
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditing({
                          id: d.id, slug: d.slug, name: toML(d.name),
                          lat: d.lat != null ? String(d.lat) : "", lng: d.lng != null ? String(d.lng) : "",
                          intro: toML(d.intro), meta_title: toML(d.meta_title), meta_description: toML(d.meta_description),
                          active: d.active, sort: d.sort,
                        })}
                        className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                      >
                        এডিট
                      </button>
                      <ConfirmButton
                        onConfirm={() =>
                          startTransition(async () => {
                            const res = await deleteDistrict(d.id);
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
