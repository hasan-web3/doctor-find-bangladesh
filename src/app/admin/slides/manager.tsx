"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSlide } from "@/actions/admin-content";
import { Toast, StatusBadge, ConfirmButton } from "@/components/admin/ui";
import { toML } from "@/lib/utils";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { SlideForm, EMPTY_SLIDE, type SlideDraft } from "./form";
import { Icon } from "@/components/icons";
import { bnNum } from "@/lib/bn";

export type SlideRow = {
  id: number; title: unknown; text: unknown; icon: string;
  cta_label: unknown; cta_href: string | null; sort: number; active: boolean; image_url: string | null;
};

export function SlidesManager({ rows }: { rows: SlideRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<SlideDraft | null>(null);

  const handleClose = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => { setEditing({ ...EMPTY_SLIDE, sort: rows.length }); }}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + নতুন স্লাইড
        </button>
      </div>

      <FullPageModal
        isOpen={!!editing}
        onClose={handleClose}
        title={editing?.id ? "স্লাইড এডিট" : "নতুন স্লাইড"}
        hideHeader={true}
      >
        {editing && <SlideForm initial={editing} onFinished={handleClose} />}
      </FullPageModal>

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
                onClick={() => { setEditing({ id: s.id, title: toML(s.title), text: toML(s.text), icon: s.icon, cta_label: toML(s.cta_label), cta_href: s.cta_href || "", sort: s.sort, active: s.active, image_url: s.image_url }); }}
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
