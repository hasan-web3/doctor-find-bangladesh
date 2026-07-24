"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSpecialty } from "@/actions/admin-content";
import { Toast, StatusBadge, ConfirmButton } from "@/components/admin/ui";
import { toML, type ML } from "@/lib/utils";
import { Icon } from "@/components/icons";
import { bnNum } from "@/lib/bn";
import { Pagination } from "@/components/admin/pagination";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { SpecialtyForm, EMPTY_SPECIALTY } from "./form";

export type SpecialtyRow = {
  id: number; slug: string; name: unknown; icon: string; tint: number;
  intro: unknown; meta_title: unknown; meta_description: unknown;
  active: boolean; sort: number; doctor_count: number;
};

type Draft = {
  id?: number; slug: string; name: ML; icon: string; tint: number;
  intro: ML; meta_title: ML; meta_description: ML; active: boolean; sort: number;
};

export function SpecialtiesManager({
  rows,
  totalPages,
  page,
  perPage,
  totalCount,
}: {
  rows: SpecialtyRow[];
  totalPages: number;
  page: number;
  perPage: number;
  totalCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);

  const handleClose = () => {
    setEditing(null);
    router.refresh();
  }

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setEditing({ ...EMPTY_SPECIALTY, sort: totalCount })}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + নতুন বিভাগ
        </button>
      </div>

      <FullPageModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "বিভাগ এডিট" : "নতুন বিভাগ"}
        hideHeader={true}
      >
        {editing && <SpecialtyForm initial={editing} onFinished={handleClose} />}
      </FullPageModal>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              {["বিভাগ", "English", "Slug", "ডাক্তার", "স্ট্যাটাস", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3.5 text-left text-[12.5px] font-semibold text-ink-ghost">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const name = toML(s.name);
              return (
                <tr key={s.id}>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <div className="flex items-center gap-2.5 text-sm font-semibold text-ink">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <Icon name={s.icon} size={17} />
                      </span>
                      {name.bn}
                    </div>
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-mute">{name.en || "..."}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-faint">{s.slug}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{bnNum(s.doctor_count)}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <StatusBadge tone={s.active ? "green" : "gray"}>{s.active ? "সক্রিয়" : "নিষ্ক্রিয়"}</StatusBadge>
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditing({
                          id: s.id, slug: s.slug, name: toML(s.name), icon: s.icon, tint: s.tint,
                          intro: toML(s.intro), meta_title: toML(s.meta_title), meta_description: toML(s.meta_description),
                          active: s.active, sort: s.sort,
                        })}
                        className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                      >
                        এডিট
                      </button>
                      <ConfirmButton
                        onConfirm={() =>
                          startTransition(async () => {
                            const res = await deleteSpecialty(s.id);
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
      <Pagination
        page={page}
        totalPages={totalPages}
        perPage={perPage}
        showPerPageSelector={true}
      />
    </div>
  );
}
