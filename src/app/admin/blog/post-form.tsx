"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
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

export function PostForm({
  initial,
  categories,
  onFinished,
}: {
  initial: PostInitial;
  categories: { id: number; name_bn: string }[];
  onFinished?: () => void;
}) {
  const router = useRouter();
  const handleFinished = onFinished || (() => {
    router.push("/admin/blog");
    router.refresh();
  });
  const handleCancel = onFinished || (() => {
    router.push("/admin/blog");
  });

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
      if (res.ok) {
        handleFinished();
      } else {
        window.scrollTo(0, 0);
      }
    });
  };

  return (
    <div className="relative">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white p-4 sm:p-5">
        <h2 className="font-heading text-xl font-bold text-ink">
          {form.id ? "আর্টিকেল এডিট" : "নতুন আর্টিকেল"}
        </h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleCancel} className="rounded-[10px] border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-mute hover:bg-slate-50 transition-colors">
            বাতিল
          </button>
          <button type="button" onClick={submit} disabled={pending} className="rounded-[10px] bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60 transition-colors">
            {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
          <div className="h-6 w-px bg-line mx-1" />
          <button type="button" onClick={handleCancel} aria-label="Close" className="rounded-full p-2 text-ink-ghost transition-colors hover:bg-slate-100 hover:text-ink">
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="p-6 pb-28">
        <Toast result={result} />
        <div className="flex flex-col gap-5">
          {/* Cover and basic info */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
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
            </div>
          </div>

          {/* Article Content - Side by Side Editors */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <label className="mb-3 block text-[13px] font-semibold text-ink-soft">আর্টিকেল</label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-bold text-brand-600">বাংলা (আবশ্যক)</div>
                <RichTextEditor
                  value={form.content.bn}
                  onChange={(html) => setForm({ ...form, content: { ...form.content, bn: html } })}
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-bold text-ink-ghost">English (optional)</div>
                <RichTextEditor
                  value={form.content.en}
                  onChange={(html) => setForm({ ...form, content: { ...form.content, en: html } })}
                />
              </div>
            </div>
          </div>

          {/* SEO Options */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <div className="mb-1 font-heading text-base font-bold text-ink">SEO (ঐচ্ছিক)</div>
            <p className="mb-4 mt-0 text-[13px] text-ink-ghost">
              বাংলা মেটা বাংলা সার্চে, ইংরেজি মেটা ইংরেজি সার্চে ব্যবহৃত হবে।
            </p>
            <div className="flex flex-col gap-4">
              <MLInput label="মেটা টাইটেল (SEO)" value={form.meta_title} onChange={(v) => setForm({ ...form, meta_title: v })} />
              <MLInput label="মেটা ডেসক্রিপশন (SEO)" value={form.meta_description} onChange={(v) => setForm({ ...form, meta_description: v })} />
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-line bg-white/80 p-4 backdrop-blur-sm">
        <div className="flex justify-end gap-3">
          <button onClick={handleCancel} className="rounded-[10px] border border-line bg-white px-6 py-3 text-[14.5px] font-semibold text-ink-mute">
            বাতিল
          </button>
          <button onClick={submit} disabled={pending} className="rounded-[10px] bg-brand-600 px-6 py-3 text-[14.5px] font-bold text-white hover:bg-brand-700 disabled:opacity-60">
            {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </div>
    </div>
  );
}

