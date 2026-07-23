"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getDoctor } from "@/actions/admin-doctors";
import { type DoctorInitial, DoctorForm } from "./doctor-form";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { StatusBadge } from "@/components/admin/ui";
import { Pagination } from "@/components/admin/pagination";
import { bnNum, bnDate } from "@/lib/bn";
import { DeleteDoctorButton } from "./delete-button";
import { EMPTY_SOCIAL_LINKS } from "@/lib/utils";

const emptyML = { bn: "", en: "" };

const NEW_DOCTOR: DoctorInitial = {
  name: { ...emptyML }, slug: "", degrees: { ...emptyML }, bio: { ...emptyML }, gender: null,
  experience_years: null, patients_served: { ...emptyML },
  hospital_id: null,
  verified: true, featured: false, active: true,
  meta_title: { ...emptyML }, meta_description: { ...emptyML }, photo_url: null,
  social_links: EMPTY_SOCIAL_LINKS(),
  specialty_ids: [],
  chambers: [{
    name: { ...emptyML }, address: { ...emptyML },
    district_id: null, area_id: null, fee: 0, phone: "", map_url: "",
    visible: false, lat: null, lng: null,
    schedule: [],
  }],
};

type Opt = { id: number; name_bn: string; name_en: string | null };
type AreaOpt = {
  id: number; name_bn: string; name_en: string | null;
  district_id: number | null; district_bn: string | null; district_en?: string | null;
};
type Row = {
  id: number; slug: string; name_bn: string; verified: boolean; featured: boolean; active: boolean;
  specialty_bn: string | null; area_bn: string | null; promo_ends: string | null;
};

export function DoctorsList({
  rows,
  total,
  page,
  perPage,
  q,
  filter,
  specialties,
  areas,
  hospitals,
  districts,
}: {
  rows: Row[];
  total: number;
  page: number;
  perPage: number;
  q: string;
  filter?: string;
  specialties: Opt[];
  areas: AreaOpt[];
  hospitals: Opt[];
  districts: Opt[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorInitial | null>(null);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");

  const handleAddNew = () => {
    setEditingDoctor(NEW_DOCTOR);
    setModalMode("add");
    setModalOpen(true);
  };

  const handleEdit = (id: number) => {
    startTransition(async () => {
      const doctor = await getDoctor(id);
      if (doctor) {
        setEditingDoctor(doctor);
        setModalMode("edit");
        setModalOpen(true);
      }
    });
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingDoctor(null);
  };
  
  const handleFinished = () => {
    handleCloseModal();
    router.refresh();
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">ডাক্তার ম্যানেজমেন্ট</h1>

      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <form className="flex min-w-[220px] max-w-[340px] flex-1 items-center gap-2 rounded-[10px] border border-line bg-white px-3">
          <span className="text-ink-ghost">⌕</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="ডাক্তার খুঁজুন"
            className="flex-1 border-none bg-transparent py-2.5 text-sm outline-none"
          />
        </form>
        <div className="flex gap-2">
          {[["", "সব"], ["featured", "ফিচার্ড"], ["inactive", "নিষ্ক্রিয়"]].map(([value, label]) => (
            <Link
              key={value}
              href={`/admin/doctors${value ? `?filter=${value}` : ""}`}
              className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold ${
                (filter || "") === value ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-white text-ink-mute"
              }`}
            >
              {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={handleAddNew}
            className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700"
          >
            + নতুন ডাক্তার যুক্ত করুন
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr>
              {["ডাক্তার", "বিভাগ", "থানা / উপজেলা", "স্ট্যাটাস", "ফিচার্ড", "প্রমোশন মেয়াদ", "অ্যাকশন"].map((h) => (
                <th key={h} className="border-b border-line px-3.5 py-3 text-left text-[12.5px] font-semibold text-ink-ghost">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">
                  <button onClick={() => handleEdit(d.id)} className="hover:text-brand-600 text-left">
                    {d.name_bn}
                  </button>
                  {d.verified && <span className="mr-1.5 text-xs text-accent-text"> ✓</span>}
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{d.specialty_bn || "..."}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{d.area_bn || "..."}</td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                  <StatusBadge tone={d.active ? "green" : "amber"}>{d.active ? "সক্রিয়" : "নিষ্ক্রিয়"}</StatusBadge>
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-xs font-bold text-[#B45309]">
                  {d.featured ? "★ হ্যাঁ" : ""}
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13px] text-ink-faint">
                  {d.promo_ends ? bnDate(d.promo_ends) : "..."}
                </td>
                <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEdit(d.id)}
                      className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                    >
                      এডিট
                    </button>
                    <Link
                      href={`/doctors/${d.slug}`}
                      target="_blank"
                      className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] text-ink-mute"
                    >
                      দেখুন
                    </Link>
                    <DeleteDoctorButton id={d.id} />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-ghost">
                  কোনো ডাক্তার পাওয়া যায়নি। উপরের বাটন থেকে নতুন ডাক্তার যুক্ত করুন।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        locale="bn"
        perPage={perPage}
        showPerPageSelector={true}
      />

      <div className="mt-2 text-[13px] text-ink-ghost">মোট {bnNum(total)} জন ডাক্তার</div>

      <FullPageModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={modalMode === 'add' ? "নতুন ডাক্তার যুক্ত করুন" : `ডাক্তার এডিট: ${editingDoctor?.name.bn}`}
        hideHeader={true}
      >
        {(isPending) && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70">
                <p>Loading...</p>
            </div>
        )}
        {editingDoctor && (
          <DoctorForm
            initial={editingDoctor}
            specialties={specialties}
            areas={areas}
            hospitals={hospitals}
            districts={districts}
            onFinished={handleFinished}
          />
        )}
      </FullPageModal>
    </div>
  );
}
