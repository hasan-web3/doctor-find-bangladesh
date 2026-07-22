"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSlide, deleteSlide } from "@/actions/admin-content";
import { Field, inputCls, Toggle, Toast, StatusBadge, ConfirmButton, ImageUpload, MLInput } from "@/components/admin/ui";
import { toML, emptyML, type ML } from "@/lib/utils";
import { Icon, ICON_KEYS } from "@/components/icons";
import { bnNum } from "@/lib/bn";

export type SlideRow = {
  id: number; title: unknown; text: unknown; icon: string;
  cta_label: unknown; cta_href: string | null; sort: number; active: boolean; image_url: string | null;
};

type Draft = {
  id?: number; title: ML; text: ML; icon: string;
  cta_label: ML; cta_href: string; sort: number; active: boolean; image_url: string | null;
};

export function SlidesManager({ rows }: { rows: SlideRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [imageData, setImageData] = useState<string | undefined>();
  const [removeImage, setRemoveImage] = useState(false);

  const submit = () => {
    if (!editing) return;
    startTransition(async () => {
      const res = await saveSlide({ ...editing, image_data: imageData, remove_image: removeImage });
      setResult(res);
      if (res.ok) { setEditing(null); setImageData(undefined); setRemoveImage(false); router.refresh(); }
    });
  };

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => { setEditing({ title: { ...emptyML }, text: { ...emptyML }, icon: "shield", cta_label: { ...emptyML }, cta_href: "", sort: rows.length, active: true, image_url: null }); setImageData(undefined); setRemoveImage(false); }}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + নতুন স্লাইড
        </button>
      </div>

      {editing && (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-[200px_1fr]">
            <ImageUpload
              currentUrl={removeImage ? null : editing.image_url}
              label="স্লাইড ছবি"
              aspect="aspect-[4/5]"
              onChange={(data) => { setImageData(data); setRemoveImage(false); }}
              onRemove={() => { setImageData(undefined); setRemoveImage(true); }}
            />
            <div className="flex flex-col gap-4">
              <MLInput label="শিরোনাম" required value={editing.title} onChange={(v) => setEditing({ ...editing, title: v })} />
              <MLInput label="বিবরণ" value={editing.text} onChange={(v) => setEditing({ ...editing, text: v })} />
              <Field label="আইকন">
                <div className="flex flex-wrap gap-2">
                  {ICON_KEYS.slice(0, 16).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditing({ ...editing, icon: key })}
                      className={`flex h-9 w-9 items-center justify-center rounded-[9px] border ${
                        editing.icon === key ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-white text-ink-faint"
                      }`}
                    >
                      <Icon name={key} size={18} />
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MLInput label="বাটন লেবেল (ঐচ্ছিক)" value={editing.cta_label} onChange={(v) => setEditing({ ...editing, cta_label: v })} />
                <div className="grid grid-cols-1 gap-4">
                  <Field label="বাটন লিংক (ঐচ্ছিক)">
                    <input className={inputCls + " font-latin"} value={editing.cta_href} onChange={(e) => setEditing({ ...editing, cta_href: e.target.value })} placeholder="/doctors" />
                  </Field>
                  <Field label="ক্রম">
                    <input type="number" className={inputCls} value={editing.sort} onChange={(e) => setEditing({ ...editing, sort: Number(e.target.value) || 0 })} />
                  </Field>
                </div>
              </div>
              <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="সক্রিয়" />
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
        {rows.map((s) => {
          const title = toML(s.title);
          const text = toML(s.text);
          return (
            <div key={s.id} className="flex items-center gap-3.5 rounded-[14px] border border-line bg-white p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#F1F5F9] font-heading font-bold text-ink-faint">
                {bnNum(s.sort + 1)}
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon name={s.icon} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-semibold text-ink">
                  {title.bn}{title.en ? ` / ${title.en}` : ""}
                </div>
                <div className="truncate text-[12.5px] text-ink-ghost">{text.bn}</div>
              </div>
              <StatusBadge tone={s.active ? "green" : "gray"}>{s.active ? "সক্রিয়" : "নিষ্ক্রিয়"}</StatusBadge>
              <button
                onClick={() => { setEditing({ id: s.id, title: toML(s.title), text: toML(s.text), icon: s.icon, cta_label: toML(s.cta_label), cta_href: s.cta_href || "", sort: s.sort, active: s.active, image_url: s.image_url }); setImageData(undefined); setRemoveImage(false); }}
                className="rounded-lg border border-line bg-white px-[13px] py-2 text-[12.5px] font-semibold text-brand-600"
              >
                এডিট
              </button>
              <ConfirmButton
                onConfirm={() =>
                  startTransition(async () => {
                    await deleteSlide(s.id);
                    router.refresh();
                  })
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
