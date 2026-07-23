"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteArea } from "@/actions/admin-content";
import { Toast, StatusBadge, ConfirmButton } from "@/components/admin/ui";
import { Pagination } from "@/components/admin/pagination";
import { toML, type ML } from "@/lib/utils";
import { num as bnNum } from "@/lib/i18n";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { AreaForm, EMPTY_AREA } from "./form";

export type AreaRow = {
  id: number; slug: string; name: unknown;
  district_id: number | null; district_bn: string | null;
  lat: number | null; lng: number | null; intro: unknown;
  meta_title: unknown; meta_description: unknown; active: boolean; sort: number; doctor_count: number;
};

type Draft = {
  id?: number; slug: string; name: ML;
  district_id: number | null;
  lat: string; lng: string; intro: ML; meta_title: ML; meta_description: ML;
  active: boolean; sort: number;
};

export function AreasManager({
  rows,
  districts,
  totalPages,
  page,
  perPage,
  totalCount,
}: {
  rows: AreaRow[];
  districts: { id: number; name_bn: string; name_en: string | null }[];
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
          onClick={() => setEditing({ ...EMPTY_AREA, sort: totalCount })}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + নতুন থানা / উপজেলা
        </button>
      </div>

      <FullPageModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "থানা / উপজেলা এডিট" : "নতুন থানা / উপজেলা"}
        hideHeader={true}
      >
        {editing && <AreaForm initial={editing} districts={districts} onFinished={handleClose} />}
      </FullPageModal>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr>
              {["থানা / উপজেলা", "জেলা", "English", "Slug", "ডাক্তার", "স্ট্যাটাস", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3 text-left text-[12.5px] font-semibold text-ink-ghost">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const name = toML(a.name);
              return (
                <tr key={a.id}>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">{name.bn}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{a.district_bn || "..."}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-mute">{name.en || "..."}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-faint">{a.slug}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{bnNum(a.doctor_count, "bn")}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <StatusBadge tone={a.active ? "green" : "gray"}>{a.active ? "সক্রিয়" : "নিষ্ক্রিয়"}</StatusBadge>
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditing({
                          id: a.id, slug: a.slug, name: toML(a.name),
                          district_id: a.district_id,
                          lat: a.lat != null ? String(a.lat) : "", lng: a.lng != null ? String(a.lng) : "",
                          intro: toML(a.intro), meta_title: toML(a.meta_title), meta_description: toML(a.meta_description),
                          active: a.active, sort: a.sort,
                        })}
                        className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                      >
                        এডিট
                      </button>
                      <ConfirmButton
                        onConfirm={() =>
                          startTransition(async () => {
                            const res = await deleteArea(a.id);
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
