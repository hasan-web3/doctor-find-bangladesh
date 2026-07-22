"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTestimonial, deleteTestimonial } from "@/actions/admin-content";
import { Field, inputCls, Toggle, Toast, StatusBadge, ConfirmButton, ImageUpload, MLInput } from "@/components/admin/ui";
import { toML, emptyML, type ML } from "@/lib/utils";

export type TestimonialRow = {
  id: number; name: string; area_text: unknown; quote: unknown;
  published: boolean; sort: number; photo_url: string | null;
};

type Draft = {
  id?: number; name: string; area_text: ML; quote: ML; published: boolean; sort: number; photo_url: string | null;
};

export function TestimonialsManager({ rows }: { rows: TestimonialRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [photoData, setPhotoData] = useState<string | undefined>();
  const [removePhoto, setRemovePhoto] = useState(false);

  const submit = () => {
    if (!editing) return;
    startTransition(async () => {
      const res = await saveTestimonial({ ...editing, photo_data: photoData, remove_photo: removePhoto });
      setResult(res);
      if (res.ok) { setEditing(null); setPhotoData(undefined); setRemovePhoto(false); router.refresh(); }
    });
  };

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => { setEditing({ name: "", area_text: { ...emptyML }, quote: { ...emptyML }, published: true, sort: rows.length, photo_url: null }); setPhotoData(undefined); setRemovePhoto(false); }}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + নতুন মতামত
        </button>
      </div>

      {editing && (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-[160px_1fr]">
            <ImageUpload
              currentUrl={removePhoto ? null : editing.photo_url}
              label="ছবি"
              onChange={(data) => { setPhotoData(data); setRemovePhoto(false); }}
              onRemove={() => { setPhotoData(undefined); setRemovePhoto(true); }}
            />
            <div className="flex flex-col gap-4">
              <Field label="নাম">
                <input className={inputCls} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <MLInput label="এলাকা" value={editing.area_text} onChange={(v) => setEditing({ ...editing, area_text: v })} />
              <MLInput label="মতামত" required textarea value={editing.quote} onChange={(v) => setEditing({ ...editing, quote: v })} />
              <Toggle checked={editing.published} onChange={(v) => setEditing({ ...editing, published: v })} label="প্রকাশিত" />
            </div>
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
        {rows.map((row) => {
          const quote = toML(row.quote);
          const areaText = toML(row.area_text);
          return (
            <div key={row.id} className="flex flex-wrap items-start gap-3.5 rounded-[14px] border border-line bg-white p-[18px]">
              <div className="min-w-[220px] flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2.5">
                  <span className="text-[15px] font-bold text-ink">{row.name}</span>
                  <span className="text-[13px] text-ink-ghost">{areaText.bn}</span>
                  <StatusBadge tone={row.published ? "green" : "gray"}>{row.published ? "প্রকাশিত" : "অপ্রকাশিত"}</StatusBadge>
                </div>
                <p className="m-0 text-sm italic text-ink-mute">{quote.bn}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing({ id: row.id, name: row.name, area_text: toML(row.area_text), quote: toML(row.quote), published: row.published, sort: row.sort, photo_url: row.photo_url }); setPhotoData(undefined); setRemovePhoto(false); }}
                  className="rounded-[9px] border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-600"
                >
                  এডিট
                </button>
                <ConfirmButton
                  onConfirm={() =>
                    startTransition(async () => {
                      await deleteTestimonial(row.id);
                      router.refresh();
                    })
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
