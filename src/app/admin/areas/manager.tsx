"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveArea, deleteArea } from "@/actions/admin-content";
import { quickCreateDistrict } from "@/actions/admin-quick-create";
import { Field, inputCls, Toggle, Toast, StatusBadge, ConfirmButton, MLInput } from "@/components/admin/ui";
import { SearchableSelect, QuickAddModal, type Option } from "@/components/admin/searchable-select";
import { toML, emptyML, type ML } from "@/lib/utils";
import { num as bnNum } from "@/lib/i18n";

export type AreaRow = {
  id: number; slug: string; name: unknown;
  district_id: number | null; district_bn: string | null;
  lat: number | null; lng: number | null; intro: unknown;
  meta_title: unknown; meta_description: unknown; active: boolean; sort: number; doctor_count: number;
};

type Draft = {
  id?: number; slug: string; name: ML;
  district_id: number | null;
  lat: string; lng: string; intro: ML; meta_title: ML; meta_description: ML;
  active: boolean; sort: number;
};

const EMPTY: Draft = {
  slug: "", name: { ...emptyML },
  district_id: null,
  lat: "", lng: "", intro: { ...emptyML }, meta_title: { ...emptyML }, meta_description: { ...emptyML },
  active: true, sort: 0,
};

export function AreasManager({
  rows,
  districts: initialDistricts,
}: {
  rows: AreaRow[];
  districts: { id: number; name_bn: string; name_en: string | null }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [showAddDistrict, setShowAddDistrict] = useState(false);
  // Keep the district list in local state so an inline "add new" reflects immediately.
  const [districts, setDistricts] = useState<{ id: number; name_bn: string; name_en: string | null }[]>(initialDistricts);

  const submit = () => {
    if (!editing) return;
    if (!editing.district_id) {
      setResult({ ok: false, message: "জেলা নির্বাচন করুন" });
      return;
    }
    startTransition(async () => {
      const res = await saveArea({
        ...editing,
        lat: editing.lat === "" ? null : Number(editing.lat),
        lng: editing.lng === "" ? null : Number(editing.lng),
      });
      setResult(res);
      if (res.ok) { setEditing(null); router.refresh(); }
    });
  };

  const districtOptions: Option[] = districts.map((d) => ({ id: d.id, label: d.name_bn, label_en: d.name_en }));

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setEditing({ ...EMPTY, sort: rows.length })}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + নতুন থানা / উপজেলা
        </button>
      </div>

      {editing && (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-white p-6">
          <div className="mb-4 font-heading text-base font-bold text-ink">{editing.id ? "থানা / উপজেলা এডিট" : "নতুন থানা / উপজেলা"}</div>
          <div className="flex flex-col gap-4">
            <MLInput label="নাম" required value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} hint="ইংরেজি নাম URL ও IP জিও-ম্যাচিংয়ে ব্যবহৃত হয়" />

            <Field label="জেলা" hint="তালিকায় না থাকলে '+ নতুন জেলা যোগ করুন' দিয়ে সাথে সাথে যোগ করুন">
              <SearchableSelect
                options={districtOptions}
                value={editing.district_id}
                onChange={(id) => setEditing({ ...editing, district_id: id })}
                placeholder="জেলা নির্বাচন করুন"
                addLabel="+ নতুন জেলা যোগ করুন"
                onAddClick={() => setShowAddDistrict(true)}
              />
            </Field>

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

      {showAddDistrict && (
        <QuickAddModal
          title="নতুন জেলা যোগ করুন"
          onClose={() => setShowAddDistrict(false)}
          onSubmit={async (name) => {
            const res = await quickCreateDistrict(name);
            if (res.ok) {
              // Insert the fresh row so the select shows it immediately.
              setDistricts((prev) => [...prev, { id: res.row.id, name_bn: res.row.name_bn, name_en: res.row.name_en }]);
              if (editing) setEditing({ ...editing, district_id: res.row.id });
              setShowAddDistrict(false);
              router.refresh();
              return { ok: true };
            }
            return { ok: false, message: res.message };
          }}
        />
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr>
              {["থানা / উপজেলা", "জেলা", "English", "Slug", "ডাক্তার", "স্ট্যাটাস", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3 text-left text-[12.5px] font-semibold text-ink-ghost">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const name = toML(a.name);
              return (
                <tr key={a.id}>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">{name.bn}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{a.district_bn || "..."}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-mute">{name.en || "..."}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-faint">{a.slug}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{bnNum(a.doctor_count, "bn")}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <StatusBadge tone={a.active ? "green" : "gray"}>{a.active ? "সক্রিয়" : "নিষ্ক্রিয়"}</StatusBadge>
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditing({
                          id: a.id, slug: a.slug, name: toML(a.name),
                          district_id: a.district_id,
                          lat: a.lat != null ? String(a.lat) : "", lng: a.lng != null ? String(a.lng) : "",
                          intro: toML(a.intro), meta_title: toML(a.meta_title), meta_description: toML(a.meta_description),
                          active: a.active, sort: a.sort,
                        })}
                        className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                      >
                        এডিট
                      </button>
                      <ConfirmButton
                        onConfirm={() =>
                          startTransition(async () => {
                            const res = await deleteArea(a.id);
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
