"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveSettings, saveSeoOverride, deleteSeoOverride, saveRedirect, deleteRedirect, regenerateSitemap,
} from "@/actions/admin-system";
import { Field, inputCls, Toast, ConfirmButton, MLInput } from "@/components/admin/ui";
import { emptyML, type ML } from "@/lib/utils";

type Override = { id: number; path: string; meta_title: ML; meta_description: ML; og_image_url: string | null };
type Redirect = { id: number; from_path: string; to_path: string; permanent: boolean };

export function SeoManager({
  defaults,
  overrides,
  redirects,
}: {
  defaults: { seo_title_template: ML; seo_default_title: ML; seo_default_description: ML; seo_default_og_image: string };
  overrides: Override[];
  redirects: Redirect[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [globals, setGlobals] = useState(defaults);
  const [ov, setOv] = useState<{ path: string; meta_title: ML; meta_description: ML; og_image_url: string }>({
    path: "", meta_title: { ...emptyML }, meta_description: { ...emptyML }, og_image_url: "",
  });
  const [rd, setRd] = useState({ from_path: "", to_path: "" });

  return (
    <div className="flex max-w-[880px] flex-col gap-6">
      <Toast result={result} />

      {/* global defaults */}
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-base font-bold text-ink">গ্লোবাল ডিফল্ট</div>
          <button
            onClick={() => startTransition(async () => setResult(await regenerateSitemap()))}
            disabled={pending}
            className="rounded-[9px] border border-brand-600 bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-700 disabled:opacity-60"
          >
            ⟳ সাইটম্যাপ রিজেনারেট করুন
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <MLInput label="টাইটেল টেমপ্লেট" hint="%s এর জায়গায় পেজের টাইটেল বসবে" value={globals.seo_title_template} onChange={(v) => setGlobals({ ...globals, seo_title_template: v })} />
          <MLInput label="ডিফল্ট মেটা টাইটেল (হোমপেজ)" value={globals.seo_default_title} onChange={(v) => setGlobals({ ...globals, seo_default_title: v })} />
          <MLInput label="ডিফল্ট মেটা ডেসক্রিপশন" textarea rows={2} value={globals.seo_default_description} onChange={(v) => setGlobals({ ...globals, seo_default_description: v })} />
          <Field label="ডিফল্ট OG ইমেজ URL (ঐচ্ছিক)" hint="খালি রাখলে স্বয়ংক্রিয় OG ইমেজ তৈরি হবে">
            <input className={inputCls + " font-latin"} value={globals.seo_default_og_image} onChange={(e) => setGlobals({ ...globals, seo_default_og_image: e.target.value })} />
          </Field>
          <button
            onClick={() => startTransition(async () => setResult(await saveSettings(globals)))}
            disabled={pending}
            className="self-start rounded-[10px] bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </div>

      {/* per-URL overrides */}
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="mb-1 font-heading text-base font-bold text-ink">নির্দিষ্ট URL এর মেটা ওভাররাইড</div>
        <p className="mb-4 mt-0 text-[13px] text-ink-faint">
          পাথটি বাংলা (রুট) ভার্সনের, যেমন /specialties/neurology। ইংরেজি ভার্সন (/en/...) স্বয়ংক্রিয়ভাবে English মেটা পাবে।
        </p>
        <div className="mb-4 flex flex-col gap-3">
          <Field label="পাথ">
            <input className={inputCls + " font-latin"} value={ov.path} onChange={(e) => setOv({ ...ov, path: e.target.value })} placeholder="/specialties/neurology" />
          </Field>
          <MLInput label="মেটা টাইটেল" value={ov.meta_title} onChange={(v) => setOv({ ...ov, meta_title: v })} />
          <MLInput label="মেটা ডেসক্রিপশন" value={ov.meta_description} onChange={(v) => setOv({ ...ov, meta_description: v })} />
          <Field label="OG ইমেজ URL (ঐচ্ছিক)">
            <input className={inputCls + " font-latin"} value={ov.og_image_url} onChange={(e) => setOv({ ...ov, og_image_url: e.target.value })} />
          </Field>
        </div>
        <button
          onClick={() =>
            startTransition(async () => {
              const res = await saveSeoOverride(ov);
              setResult(res);
              if (res.ok) {
                setOv({ path: "", meta_title: { ...emptyML }, meta_description: { ...emptyML }, og_image_url: "" });
                router.refresh();
              }
            })
          }
          disabled={pending || !ov.path}
          className="mb-4 rounded-[10px] bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          ওভাররাইড যোগ করুন
        </button>

        <div className="flex flex-col gap-2">
          {overrides.map((o) => (
            <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-2.5">
              <span className="font-latin text-[13px] font-semibold text-brand-700">{o.path}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink-mute">{o.meta_title.bn || o.meta_description.bn}</span>
              <button
                onClick={() => setOv({ path: o.path, meta_title: o.meta_title, meta_description: o.meta_description, og_image_url: o.og_image_url || "" })}
                className="text-[12.5px] font-semibold text-brand-600"
              >
                এডিট
              </button>
              <ConfirmButton
                onConfirm={() =>
                  startTransition(async () => {
                    await deleteSeoOverride(o.id);
                    router.refresh();
                  })
                }
              />
            </div>
          ))}
          {overrides.length === 0 && <p className="m-0 text-[13px] text-ink-ghost">কোনো ওভাররাইড নেই।</p>}
        </div>
      </div>

      {/* redirects */}
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="mb-1 font-heading text-base font-bold text-ink">রিডাইরেক্ট ম্যানেজার</div>
        <p className="mb-4 mt-0 text-[13px] text-ink-faint">
          Slug বদলালে রিডাইরেক্ট স্বয়ংক্রিয়ভাবে তৈরি হয় এবং /en ভার্সনেও কাজ করে। প্রয়োজনে ম্যানুয়ালিও যোগ করা যায় (৩০৮ পার্মানেন্ট)।
        </p>
        <div className="mb-4 flex flex-wrap gap-3">
          <input className={inputCls + " max-w-[240px] flex-1 font-latin"} value={rd.from_path} onChange={(e) => setRd({ ...rd, from_path: e.target.value })} placeholder="/old-path" />
          <span className="self-center text-ink-ghost">→</span>
          <input className={inputCls + " max-w-[240px] flex-1 font-latin"} value={rd.to_path} onChange={(e) => setRd({ ...rd, to_path: e.target.value })} placeholder="/new-path" />
          <button
            onClick={() =>
              startTransition(async () => {
                const res = await saveRedirect(rd);
                setResult(res);
                if (res.ok) { setRd({ from_path: "", to_path: "" }); router.refresh(); }
              })
            }
            disabled={pending || !rd.from_path || !rd.to_path}
            className="rounded-[10px] bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            যোগ করুন
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {redirects.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 font-latin text-[13px]">
              <span className="text-ink-mute">{r.from_path}</span>
              <span className="text-ink-ghost">→</span>
              <span className="flex-1 font-semibold text-brand-700">{r.to_path}</span>
              <ConfirmButton
                onConfirm={() =>
                  startTransition(async () => {
                    await deleteRedirect(r.id);
                    router.refresh();
                  })
                }
              />
            </div>
          ))}
          {redirects.length === 0 && <p className="m-0 text-[13px] text-ink-ghost">কোনো রিডাইরেক্ট নেই।</p>}
        </div>
      </div>
    </div>
  );
}
