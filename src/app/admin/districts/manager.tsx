"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDistrict } from "@/actions/admin-content";
import { Toast, StatusBadge, ConfirmButton } from "@/components/admin/ui";
import { toML, type ML } from "@/lib/utils";
import { bnNum } from "@/lib/bn";
import { Pagination } from "@/components/admin/pagination";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { DistrictForm, EMPTY_DISTRICT } from "./form";

export type DistrictRow = {
  id: number; slug: string; name: unknown;
  lat: number | null; lng: number | null; intro: unknown;
  meta_title: unknown; meta_description: unknown; active: boolean; sort: number; area_count: number;
};

type Draft = {
  id?: number; slug: string; name: ML; lat: string; lng: string;
  intro: ML; meta_title: ML; meta_description: ML; active: boolean; sort: number;
};

export function DistrictsManager({
  rows,
  totalPages,
  page,
  perPage,
  totalCount,
}: {
  rows: DistrictRow[];
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
          onClick={() => setEditing({ ...EMPTY_DISTRICT, sort: totalCount })}
          className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
        >
          + নতুন জেলা
        </button>
      </div>

      <FullPageModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "জেলা এডিট" : "নতুন জেলা"}
        hideHeader={true}
      >
        {editing && <DistrictForm initial={editing} onFinished={handleClose} />}
      </FullPageModal>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr>
              {["জেলা", "English", "Slug", "এলাকা", "স্ট্যাটাস", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3.5 text-right text-[12.5px] font-semibold text-ink-ghost">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const name = toML(d.name);
              return (
                <tr key={d.id}>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">{name.bn}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-mute">{name.en || "..."}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-faint">{d.slug}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{bnNum(d.area_count)}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <StatusBadge tone={d.active ? "green" : "gray"}>{d.active ? "সক্রিয়" : "নিষ্ক্রিয়"}</StatusBadge>
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditing({
                          id: d.id, slug: d.slug, name: toML(d.name),
                          lat: d.lat != null ? String(d.lat) : "", lng: d.lng != null ? String(d.lng) : "",
                          intro: toML(d.intro), meta_title: toML(d.meta_title), meta_description: toML(d.meta_description),
                          active: d.active, sort: d.sort,
                        })}
                        className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                      >
                        এডিট
                      </button>
                      <ConfirmButton
                        onConfirm={() =>
                          startTransition(async () => {
                            const res = await deleteDistrict(d.id);
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
