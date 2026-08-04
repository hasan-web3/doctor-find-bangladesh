"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBlogCategory } from "@/actions/admin-content";
import { ConfirmButton } from "@/components/admin/ui";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { CategoryForm, EMPTY_CATEGORY, type CategoryDraft } from "./category-form";
import { num as bnNum } from "@/lib/i18n";
import { toML } from "@/lib/utils";

type Cat = { id: number; slug: string; name_bn: string; name_en: string | null; post_count: number };

export function CategoriesManager({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<CategoryDraft | null>(null);

  const handleClose = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <div className="max-w-[640px] rounded-2xl border border-line bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-heading text-base font-bold text-ink">ক্যাটাগরি</div>
        <button
            onClick={() => setEditing({ ...EMPTY_CATEGORY })}
            className="shrink-0 rounded-[10px] bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          + নতুন ক্যাটাগরি
        </button>
      </div>

      <FullPageModal
        isOpen={!!editing}
        onClose={handleClose}
        title={editing?.id ? "ক্যাটাগরি এডিট" : "নতুন ক্যাটাগরি"}
        hideHeader={true}
      >
        {editing && <CategoryForm initial={editing} onFinished={handleClose} />}
      </FullPageModal>

      <div className="flex flex-col gap-2">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5">
            <span className="text-sm font-semibold text-ink">
              {c.name_bn}
              {c.name_en ? <span className="mr-1 font-latin font-normal text-ink-faint"> / {c.name_en}</span> : null}{" "}
              <span className="font-normal text-ink-ghost">({bnNum(c.post_count, "bn")}টি পোস্ট)</span>
            </span>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setEditing({ id: c.id, slug: c.slug, name: toML({bn: c.name_bn, en: c.name_en}) })}
                    className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                >
                    এডিট
                </button>
                <ConfirmButton
                onConfirm={() =>
                    startTransition(async () => {
                    await deleteBlogCategory(c.id);
                    router.refresh();
                    })
                }
                />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
