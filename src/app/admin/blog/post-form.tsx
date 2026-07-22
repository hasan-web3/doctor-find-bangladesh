"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBlogPost } from "@/actions/admin-content";
import { Field, inputCls, Toggle, Toast, ImageUpload, MLInput } from "@/components/admin/ui";
import { type ML } from "@/lib/utils";
import { RichTextEditor } from "@/components/admin/rich-text";
import { cn } from "@/lib/utils";

export type PostInitial = {
  id?: number; slug: string; title: ML; excerpt: ML; content: ML;
  category_id: number | null; published: boolean; meta_title: ML; meta_description: ML;
  cover_url: string | null;
};

export function PostForm({ initial, categories }: { initial: PostInitial; categories: { id: number; name_bn: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [form, setForm] = useState(initial);
  const [coverData, setCoverData] = useState<string | undefined>();
  const [removeCover, setRemoveCover] = useState(false);
  const [contentLang, setContentLang] = useState<"bn" | "en">("bn");

  const submit = () => {
    startTransition(async () => {
      const res = await saveBlogPost({ ...form, cover_data: coverData, remove_cover: removeCover });
      setResult(res);
      if (res.ok) { router.push("/admin/blog"); router.refresh(); }
      else window.scrollTo(0, 0);
    });
  };

  return (
    <div className="max-w-[980px]">
      <Toast result={result} />
      <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-[240px_1fr]">
        <div>
          <ImageUpload
            currentUrl={removeCover ? null : form.cover_url}
            label="কভার ছবি"
            aspect="aspect-[16/10]"
            onChange={(data) => { setCoverData(data); setRemoveCover(false); }}
            onRemove={() => { setCoverData(undefined); setRemoveCover(true); }}
          />
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
            <Toggle checked={form.published} onChange={(v) => setForm({ ...form, published: v })} label="প্রকাশিত" />
            <Field label="ক্যাটাগরি">
              <select
                className={inputCls}
                value={form.category_id ?? ""}
                onChange={(e) => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">কোনোটি নয়</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name_bn}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
          <MLInput label="শিরোনাম" required value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Slug (URL)" hint="খালি রাখলে শিরোনাম থেকে তৈরি হবে">
              <input className={inputCls + " font-latin"} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </Field>
            <div />
          </div>
          <MLInput label="সারসংক্ষেপ" value={form.excerpt} onChange={(v) => setForm({ ...form, excerpt: v })} />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-[13px] font-semibold text-ink-soft">আর্টিকেল</label>
              <div className="flex rounded-full border border-line bg-page p-0.5 text-[12px] font-bold">
                <button
                  type="button"
                  onClick={() => setContentLang("bn")}
                  className={cn("rounded-full px-3 py-1", contentLang === "bn" ? "bg-brand-600 text-white" : "text-ink-faint")}
                >
                  বাংলা
                </button>
                <button
                  type="button"
                  onClick={() => setContentLang("en")}
                  className={cn("rounded-full px-3 py-1", contentLang === "en" ? "bg-brand-600 text-white" : "text-ink-faint")}
                >
                  English
                </button>
              </div>
            </div>
            {/* Keyed remount per language so the editor loads that language's HTML. */}
            <RichTextEditor
              key={contentLang}
              value={form.content[contentLang]}
              onChange={(html) => setForm({ ...form, content: { ...form.content, [contentLang]: html } })}
            />
            <div className="mt-1 text-xs text-ink-ghost">
              {contentLang === "bn" ? "বাংলা সংস্করণ লিখছেন (আবশ্যক)" : "Writing the English version (optional, falls back to Bangla)"}
            </div>
          </div>

          <MLInput label="মেটা টাইটেল (SEO)" value={form.meta_title} onChange={(v) => setForm({ ...form, meta_title: v })} />
          <MLInput label="মেটা ডেসক্রিপশন (SEO)" value={form.meta_description} onChange={(v) => setForm({ ...form, meta_description: v })} />
        </div>
      </div>
      <div className="mt-5 flex gap-3">
        <button onClick={submit} disabled={pending} className="rounded-[10px] bg-brand-600 px-6 py-3 text-[14.5px] font-bold text-white hover:bg-brand-700 disabled:opacity-60">
          {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
        </button>
        <button onClick={() => router.push("/admin/blog")} className="rounded-[10px] border border-line bg-white px-6 py-3 text-[14.5px] text-ink-mute">
          বাতিল
        </button>
      </div>
    </div>
  );
}
