"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTestimonial } from "@/actions/admin-content";
import { Toast, StatusBadge, ConfirmButton } from "@/components/admin/ui";
import { toML } from "@/lib/utils";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { TestimonialForm, EMPTY_TESTIMONIAL, type TestimonialDraft } from "./form";

export type TestimonialRow = {
  id: number; name: string; area_text: unknown; quote: unknown;
  published: boolean; sort: number; photo_url: string | null;
};

export function TestimonialsManager({ rows }: { rows: TestimonialRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<TestimonialDraft | null>(null);

  const handleClose = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => { setEditing({ ...EMPTY_TESTIMONIAL, sort: rows.length }); }}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + নতুন মতামত
        </button>
      </div>

      <FullPageModal
        isOpen={!!editing}
        onClose={handleClose}
        title={editing?.id ? "মতামত এডিট" : "নতুন মতামত"}
        hideHeader={true}
      >
        {editing && <TestimonialForm initial={editing} onFinished={handleClose} />}
      </FullPageModal>

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
                  onClick={() => { setEditing({ id: row.id, name: row.name, area_text: toML(row.area_text), quote: toML(row.quote), published: row.published, sort: row.sort, photo_url: row.photo_url }); }}
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
