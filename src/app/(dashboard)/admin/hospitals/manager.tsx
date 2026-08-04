"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteHospital } from "@/actions/admin-content";
import { Toast, StatusBadge, ConfirmButton } from "@/components/admin/ui";
import { cn, toML, type ML } from "@/lib/utils";
import { NEW_ROW_CLASS, NewFlag, useNewRows } from "@/components/admin/notifications";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { HospitalForm, EMPTY_HOSPITAL } from "./form";
import { Pagination } from "@/components/admin/pagination";
import { DebouncedSearch } from "@/components/admin/debounced-search";

export type HospitalRow = {
  id: number; slug: string; name: unknown;
  area_id: number | null; area_bn: string | null; area_district_id: number | null;
  address: unknown; phone: string | null; lat: number | null; lng: number | null;
  description: unknown; departments: unknown; map_url: string | null; image_url: string | null;
  gallery: { key: string; url: string }[];
  meta_title: unknown; meta_description: unknown; active: boolean;
};

type SpecialtyOpt = { id: number; name_bn: string; name_en: string | null };
type AreaOpt = {
  id: number; name_bn: string; name_en: string | null;
  district_id: number | null; district_bn: string | null; district_en: string | null;
};
type DistrictOpt = { id: number; name_bn: string; name_en: string | null };

type Draft = {
  id?: number; slug: string; name: ML;
  district_id: number | null;
  area_id: number | null;
  address: ML;
  phone: string; lat: string; lng: string; description: ML;
  departments: ML[];
  map_url: string;
  meta_title: ML; meta_description: ML; active: boolean;
  image_url: string | null; gallery: { key: string; url: string }[];
};

export function HospitalsManager({
  rows,
  areas,
  specialties,
  districts,
  totalPages,
  page,
  perPage,
  q,
}: {
  rows: HospitalRow[];
  areas: AreaOpt[];
  specialties: SpecialtyOpt[];
  districts: DistrictOpt[];
  totalPages: number;
  page: number;
  perPage: number;
  q: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  // Hospitals added from the doctor form lead the list, tinted, until opened.
  const newRows = useNewRows("hospitals");
  const ordered = newRows.newFirst(rows);

  const handleClose = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <DebouncedSearch initial={q} placeholder="হাসপাতাল খুঁজুন / Search hospitals" />
        <button onClick={() => setEditing({ ...EMPTY_HOSPITAL })} className="ml-auto rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700">
          + নতুন হাসপাতাল
        </button>
      </div>

      <FullPageModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "হাসপাতাল এডিট" : "নতুন হাসপাতাল"}
        hideHeader={true}
      >
        {editing && (
          <HospitalForm
            initial={editing}
            areas={areas}
            specialties={specialties}
            districts={districts}
            onFinished={handleClose}
          />
        )}
      </FullPageModal>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr>
              {["হাসপাতাল", "English", "থানা / উপজেলা", "স্ট্যাটাস", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3 text-left text-[12.5px] font-semibold text-ink-ghost">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((h) => {
              const name = toML(h.name);
              const isNew = newRows.isNew(h.id);
              return (
                <tr key={h.id} className={cn(isNew && NEW_ROW_CLASS)}>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">
                    <span className="flex items-center gap-2">{name.bn}{isNew && <NewFlag />}</span>
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-mute">{name.en || "..."}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{h.area_bn || "..."}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <StatusBadge tone={h.active ? "green" : "gray"}>{h.active ? "সক্রিয়" : "নিষ্ক্রিয়"}</StatusBadge>
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          newRows.markRead(h.id);
                          setEditing({
                            id: h.id, slug: h.slug, name: toML(h.name),
                            district_id: h.area_district_id,
                            area_id: h.area_id,
                            address: toML(h.address), phone: h.phone || "",
                            lat: h.lat != null ? String(h.lat) : "", lng: h.lng != null ? String(h.lng) : "",
                            description: toML(h.description),
                            departments: Array.isArray(h.departments) ? (h.departments as unknown[]).map(toML) : [],
                            map_url: h.map_url ?? "",
                            meta_title: toML(h.meta_title), meta_description: toML(h.meta_description),
                            active: h.active, image_url: h.image_url, gallery: h.gallery || [],
                          });
                        }}
                        className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                      >
                        এডিট
                      </button>
                      <ConfirmButton
                        onConfirm={() =>
                          startTransition(async () => {
                            const res = await deleteHospital(h.id);
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
