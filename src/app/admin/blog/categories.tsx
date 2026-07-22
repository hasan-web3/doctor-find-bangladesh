"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBlogCategory, deleteBlogCategory } from "@/actions/admin-content";
import { inputCls, ConfirmButton } from "@/components/admin/ui";
import { num as bnNum } from "@/lib/i18n";

type Cat = { id: number; slug: string; name_bn: string; name_en: string | null; post_count: number };

export function CategoriesManager({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nameBn, setNameBn] = useState("");
  const [nameEn, setNameEn] = useState("");

  return (
    <div className="max-w-[640px] rounded-2xl border border-line bg-white p-6">
      <div className="mb-4 font-heading text-base font-bold text-ink">ক্যাটাগরি</div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className={inputCls + " min-w-[160px] flex-1"}
          value={nameBn}
          onChange={(e) => setNameBn(e.target.value)}
          placeholder="বাংলা নাম"
        />
        <input
          className={inputCls + " min-w-[160px] flex-1 font-latin"}
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder="English name (optional)"
        />
        <button
          disabled={pending || !nameBn.trim()}
          onClick={() =>
            startTransition(async () => {
              await saveBlogCategory({ name: { bn: nameBn.trim(), en: nameEn.trim() } });
              setNameBn("");
              setNameEn("");
              router.refresh();
            })
          }
          className="shrink-0 rounded-[10px] bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          যোগ করুন
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5">
            <span className="text-sm font-semibold text-ink">
              {c.name_bn}
              {c.name_en ? <span className="mr-1 font-latin font-normal text-ink-faint"> / {c.name_en}</span> : null}{" "}
              <span className="font-normal text-ink-ghost">({bnNum(c.post_count, "bn")}টি পোস্ট)</span>
            </span>
            <ConfirmButton
              onConfirm={() =>
                startTransition(async () => {
                  await deleteBlogCategory(c.id);
                  router.refresh();
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
