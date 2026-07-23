"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { saveDoctor } from "@/actions/admin-doctors";
import {
  quickCreateArea,
  quickCreateDistrict,
  quickCreateHospital,
  quickCreateSpecialty,
} from "@/actions/admin-quick-create";
import { Field, inputCls, Toggle, Toast, ImageUpload, MLInput } from "@/components/admin/ui";
import { ScheduleDayPicker, scheduleToRangesByDay } from "@/components/admin/schedule-picker";
import {
  SearchableSelect,
  SearchableMultiSelect,
  QuickAddModal,
  type Option,
} from "@/components/admin/searchable-select";
import {
  type ML,
  emptyML,
  type SocialLinksDraft,
  EMPTY_SOCIAL_LINKS,
} from "@/lib/utils";
import { parseLatLng } from "@/lib/map-coords";

type Opt = { id: number; name_bn: string; name_en: string | null };
type AreaOpt = {
  id: number; name_bn: string; name_en: string | null;
  district_id: number | null; district_bn: string | null; district_en?: string | null;
};
type Schedule = { days: ML; time: ML };
type ChamberDraft = {
  id?: number; name: ML; address: ML;
  district_id: number | null;
  area_id: number | null;
  fee: number; phone: string; map_url: string;
  // Public visibility — false hides just this chamber (doctor stays public).
  visible: boolean;
  // Extracted from map_url when possible; admin can override.
  lat: number | null; lng: number | null;
  schedule: Schedule[];
};


export type DoctorInitial = {
  id?: number; name: ML; slug: string; degrees: ML; bio: ML;
  gender: string | null; experience_years: number | null; patients_served: ML;
  hospital_id: number | null;
  verified: boolean; featured: boolean; active: boolean;
  meta_title: ML; meta_description: ML; photo_url: string | null;
  social_links: SocialLinksDraft;
  specialty_ids: number[]; chambers: ChamberDraft[];
};

const EMPTY_CHAMBER = (): ChamberDraft => ({
  name: { ...emptyML }, address: { ...emptyML },
  district_id: null, area_id: null,
  fee: 0, phone: "", map_url: "",
  visible: false, lat: null, lng: null,
  schedule: [],
});

// Modal target — which entity is being quick-added, and where to put the new id.
type ModalMode =
  | { kind: "hospital" }
  | { kind: "specialty" }
  | { kind: "district"; chamberIndex: number }
  | { kind: "area"; chamberIndex: number; districtId: number };

export function DoctorForm({
  initial,
  specialties: initialSpecialties,
  areas: initialAreas,
  hospitals: initialHospitals,
  districts: initialDistricts,
  onFinished,
}: {
  initial: DoctorInitial;
  specialties: Opt[];
  areas: AreaOpt[];
  hospitals: Opt[];
  districts: Opt[];
  onFinished?: () => void;
}) {
  const router = useRouter();
  const handleFinished = onFinished || (() => {
    router.push("/admin/doctors");
    router.refresh();
  });
  const handleCancel = onFinished || (() => {
    router.push("/admin/doctors");
  });

  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [form, setForm] = useState(initial);
  const [photoData, setPhotoData] = useState<string | undefined>();
  const [removePhoto, setRemovePhoto] = useState(false);

  // Live option lists — grow when a modal quick-creates a new entity.
  const [specialties, setSpecialties] = useState(initialSpecialties);
  const [hospitals, setHospitals] = useState(initialHospitals);
  const [districts, setDistricts] = useState(initialDistricts);
  const [areas, setAreas] = useState(initialAreas);

  const [modal, setModal] = useState<ModalMode | null>(null);

  const set = <K extends keyof DoctorInitial>(key: K, value: DoctorInitial[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setChamber = (i: number, patch: Partial<ChamberDraft>) =>
    set("chambers", form.chambers.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const submit = () => {
    startTransition(async () => {
      const res = await saveDoctor({
        ...form,
        // `?? null` (not `||`) preserves 0 — otherwise "0 years experience"
        // silently becomes null and never reaches the DB.
        experience_years: form.experience_years ?? null,
        gender: form.gender || null,
        photo_data: photoData,
        remove_photo: removePhoto,
      });
      setResult(res);
      if (res.ok) {
        handleFinished();
      } else {
        window.scrollTo(0, 0);
      }
    });
  };

  const hospitalOptions: Option[] = useMemo(
    () => hospitals.map((h) => ({ id: h.id, label: h.name_bn, label_en: h.name_en })),
    [hospitals]
  );
  const specialtyOptions: Option[] = useMemo(
    () => specialties.map((s) => ({ id: s.id, label: s.name_bn, label_en: s.name_en })),
    [specialties]
  );
  const districtOptions: Option[] = useMemo(
    () => districts.map((d) => ({ id: d.id, label: d.name_bn, label_en: d.name_en })),
    [districts]
  );

  const areasForDistrict = (districtId: number | null): Option[] =>
    (districtId ? areas.filter((a) => a.district_id === districtId) : []).map((a) => ({
      id: a.id, label: a.name_bn, label_en: a.name_en, sub: a.district_bn ?? undefined,
    }));

  return (
    <div className="relative">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white p-4 sm:p-5">
        <h2 className="font-heading text-xl font-bold text-ink">
          {form.id ? `ডাক্তার এডিট: ${form.name.bn}` : "নতুন ডাক্তার যুক্ত করুন"}
        </h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-[10px] border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-mute hover:bg-slate-50 transition-colors"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-[10px] bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
          <div className="h-6 w-px bg-line mx-1" />
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Close"
            className="rounded-full p-2 text-ink-ghost transition-colors hover:bg-slate-100 hover:text-ink"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Scrollable form content */}
      <div className="p-6 pb-28">
        <Toast result={result} />

        <div className="flex flex-col gap-5">
          {/* Main Details */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
            <div>
              <ImageUpload
                currentUrl={removePhoto ? null : form.photo_url}
                label="ডাক্তারের ছবি"
                onChange={(data) => {
                  setPhotoData(data);
                  setRemovePhoto(false);
                }}
                onRemove={() => {
                  setPhotoData(undefined);
                  setRemovePhoto(true);
                }}
              />
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
                <Toggle checked={form.verified} onChange={(v) => set("verified", v)} label="ভেরিফায়েড" />
                <Toggle checked={form.featured} onChange={(v) => set("featured", v)} label="ফিচার্ড হিসেবে দেখান" />
                <Toggle checked={form.active} onChange={(v) => set("active", v)} label="সক্রিয় (পাবলিক সাইটে দেখাবে)" />
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
              <MLInput label="নাম" required value={form.name} onChange={(v) => set("name", v)} />
              <Field
                label="Slug (URL)"
                hint="খালি রাখলে ইংরেজি/বাংলা নাম থেকে তৈরি হবে। বদলালে পুরনো URL স্বয়ংক্রিয়ভাবে রিডাইরেক্ট হবে।"
              >
                <input
                  className={inputCls + " font-latin"}
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder="dr-example"
                />
              </Field>
              <MLInput label="ডিগ্রি ও পদবি" value={form.degrees} onChange={(v) => set("degrees", v)} />
            </div>
          </div>

          {/* Bio */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <MLInput
              label="পরিচিতি"
              richText
              value={form.bio}
              onChange={(v) => set("bio", v)}
              hint="বোল্ড, লিস্ট, শিরোনাম ইত্যাদি ব্যবহার করে ডাক্তারের বিস্তারিত পরিচিতি লিখুন।"
            />
          </div>

          {/* Other Info */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="লিঙ্গ">
                <select className={inputCls} value={form.gender || ""} onChange={(e) => set("gender", e.target.value || null)}>
                  <option value="">নির্বাচন করুন</option>
                  <option value="male">পুরুষ</option>
                  <option value="female">নারী</option>
                  <option value="other">অন্যান্য</option>
                </select>
              </Field>
              <Field label="অভিজ্ঞতা (বছর)">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className={inputCls + " font-latin"}
                  value={form.experience_years ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
                    const n = raw === "" ? null : parseInt(raw, 10);
                    set("experience_years", Number.isFinite(n as number) ? (n as number) : null);
                  }}
                />
              </Field>
              <MLInput
                label="রোগী দেখেছেন"
                hint="যেমন: ১০,০০০+ / 10,000+"
                value={form.patients_served}
                onChange={(v) => set("patients_served", v)}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="প্রধান হাসপাতাল" hint="ডাক্তার মূলত যে হাসপাতালে কর্মরত। তালিকায় না থাকলে সাথে সাথে যোগ করা যাবে।">
                    <SearchableSelect
                    options={hospitalOptions}
                    value={form.hospital_id}
                    onChange={(id) => set("hospital_id", id)}
                    placeholder="হাসপাতাল নির্বাচন করুন"
                    addLabel="+ নতুন হাসপাতাল যোগ করুন"
                    onAddClick={() => setModal({ kind: "hospital" })}
                    />
                </Field>
                <Field label="বিশেষজ্ঞ বিভাগ (একাধিক নির্বাচন করা যাবে, প্রথমটি প্রধান)">
                    <SearchableMultiSelect
                    options={specialtyOptions}
                    value={form.specialty_ids}
                    onChange={(ids) => set("specialty_ids", ids)}
                    placeholder="বিভাগ নির্বাচন করুন"
                    addLabel="+ নতুন বিভাগ যোগ করুন"
                    onAddClick={() => setModal({ kind: "specialty" })}
                    primaryHint="★"
                    />
                </Field>
            </div>
          </div>

          {/* chambers */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="font-heading text-base font-bold text-ink">চেম্বার ও সময়সূচি</div>
              <button
                type="button"
                onClick={() => set("chambers", [...form.chambers, EMPTY_CHAMBER()])}
                className="rounded-[9px] border border-brand-600 bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-700"
              >
                + চেম্বার যোগ করুন
              </button>
            </div>

            {form.chambers.length === 0 && (
              <p className="text-sm text-ink-ghost">এখনো কোনো চেম্বার নেই। উপরের বাটন থেকে যোগ করুন।</p>
            )}

            <div className="flex flex-col gap-4">
              {form.chambers.map((c, i) => (
                <div key={i} className="rounded-[14px] border border-line p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-bold text-ink-soft">চেম্বার {i + 1}</div>
                    <div className="flex items-center gap-4">
                      <Toggle checked={c.visible} onChange={(v) => setChamber(i, { visible: v })} label="পাবলিক সাইটে দেখান" />
                      <button
                        type="button"
                        onClick={() => set("chambers", form.chambers.filter((_, idx) => idx !== i))}
                        className="text-[12.5px] font-semibold text-[#DC2626]"
                      >
                        মুছুন
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <MLInput label="চেম্বারের নাম" required value={c.name} onChange={(v) => setChamber(i, { name: v })} />
                    <MLInput label="ঠিকানা" value={c.address} onChange={(v) => setChamber(i, { address: v })} />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="জেলা" hint="আগে জেলা বাছুন, পরে সেই জেলার থানা / উপজেলা তালিকায় আসবে">
                        <SearchableSelect
                          options={districtOptions}
                          value={c.district_id}
                          onChange={(id) => setChamber(i, { district_id: id, area_id: null })}
                          placeholder="জেলা নির্বাচন করুন"
                          addLabel="+ নতুন জেলা যোগ করুন"
                          onAddClick={() => setModal({ kind: "district", chamberIndex: i })}
                        />
                      </Field>
                      <Field label="থানা / উপজেলা">
                        <SearchableSelect
                          options={areasForDistrict(c.district_id)}
                          value={c.area_id}
                          onChange={(id) => setChamber(i, { area_id: id })}
                          placeholder={c.district_id ? "থানা / উপজেলা নির্বাচন করুন" : "প্রথমে জেলা বাছুন"}
                          addLabel="+ নতুন থানা / উপজেলা যোগ করুন"
                          onAddClick={ c.district_id ? () => setModal({ kind: "area", chamberIndex: i, districtId: c.district_id! }) : undefined }
                          disabled={!c.district_id}
                        />
                      </Field>
                      <Field label="ভিজিট ফি (টাকা)">
                        <input type="number" className={inputCls} value={c.fee || ""} onChange={(e) => setChamber(i, { fee: Number(e.target.value) || 0 })} />
                      </Field>
                      <Field label="সিরিয়াল নম্বর (ফোন)">
                        <input className={inputCls + " font-latin"} value={c.phone} onChange={(e) => setChamber(i, { phone: e.target.value })} placeholder="01XXXXXXXXX" />
                      </Field>
                    </div>
                    <Field
                      label="গুগল ম্যাপ (ঐচ্ছিক)"
                      hint="সম্পূর্ণ <iframe ...> ট্যাগ বা শুধু URL — যেকোনোটা paste করুন। server auto-extract করে শুধু map link সংরক্ষণ করবে। খালি রাখলে frontend-এ map hidden থাকবে।"
                    >
                      <textarea
                        rows={3}
                        className={inputCls + " font-latin resize-y"}
                        value={c.map_url}
                        onChange={(e) => {
                          const nextUrl = e.target.value;
                          const coords = parseLatLng(nextUrl);
                          const patch: Partial<ChamberDraft> = { map_url: nextUrl };
                          if (coords) { patch.lat = coords.lat; patch.lng = coords.lng; }
                          else if (!nextUrl.trim()) { patch.lat = null; patch.lng = null; }
                          setChamber(i, patch);
                        }}
                        placeholder={'<iframe src="https://www.google.com/maps/embed?pb=..." ...></iframe>  বা  https://maps.app.goo.gl/xxx'}
                      />
                    </Field>
                    {c.map_url.trim() && (c.lat != null || c.lng != null || parseLatLng(c.map_url)) && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Latitude" hint="ম্যাপ থেকে অটো-এক্সট্র্যাক্ট হয়েছে; দরকার হলে এডিট করুন।">
                          <input type="number" step="any" className={inputCls + " font-latin"} value={c.lat ?? ""} onChange={(e) => { const raw = e.target.value; setChamber(i, { lat: raw === "" ? null : Number(raw) }); }} placeholder="22.821203" />
                        </Field>
                        <Field label="Longitude" hint="ম্যাপ থেকে অটো-এক্সট্র্যাক্ট হয়েছে; দরকার হলে এডিট করুন।">
                          <input type="number" step="any" className={inputCls + " font-latin"} value={c.lng ?? ""} onChange={(e) => { const raw = e.target.value; setChamber(i, { lng: raw === "" ? null : Number(raw) }); }} placeholder="89.538703" />
                        </Field>
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <div className="mb-1.5 text-[13px] font-semibold text-ink-soft">সময়সূচি</div>
                    <ScheduleDayPicker
                      value={c.schedule}
                      onChange={(next) => setChamber(i, { schedule: next })}
                      bookedElsewhere={scheduleToRangesByDay( form.chambers.flatMap((oc, oi) => (oi === i ? [] : oc.schedule)) )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Social profiles */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <div className="mb-1 font-heading text-base font-bold text-ink">সামাজিক প্রোফাইল / Social profiles (SEO)</div>
            <p className="mb-4 mt-0 text-[13px] text-ink-ghost">
              ডাক্তারের ভেরিফায়েড পাবলিক প্রোফাইল লিঙ্ক দিন — এগুলো Physician schema-এর{" "}
              <code className="font-latin">sameAs</code>-এ যায় এবং Google Knowledge Panel-এর যোগ্যতা বাড়ায়। পুরো URL
              (https://...) দিন; নাহলে সেভ হবে না।
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { key: "website" as const, label: "অফিসিয়াল ওয়েবসাইট / Website", placeholder: "https://drname.com" },
                { key: "linkedin" as const, label: "LinkedIn", placeholder: "https://www.linkedin.com/in/..." },
                { key: "facebook" as const, label: "Facebook", placeholder: "https://www.facebook.com/..." },
                { key: "twitter" as const, label: "Twitter / X", placeholder: "https://x.com/..." },
                { key: "instagram" as const, label: "Instagram", placeholder: "https://www.instagram.com/..." },
                { key: "youtube" as const, label: "YouTube", placeholder: "https://www.youtube.com/@..." },
                { key: "researchgate" as const, label: "ResearchGate", placeholder: "https://www.researchgate.net/profile/...", },
              ].map(({ key, label, placeholder }) => (
                <Field key={key} label={label}>
                  <input
                    type="url"
                    className={inputCls + " font-latin"}
                    value={form.social_links[key]}
                    onChange={(e) => set("social_links", { ...form.social_links, [key]: e.target.value })}
                    placeholder={placeholder}
                  />
                </Field>
              ))}
            </div>
          </div>

          {/* SEO */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <div className="mb-1 font-heading text-base font-bold text-ink">SEO (ঐচ্ছিক)</div>
            <p className="mb-4 mt-0 text-[13px] text-ink-ghost">
              বাংলা মেটা বাংলা সার্চে, ইংরেজি মেটা ইংরেজি সার্চে (/en পেজে) ব্যবহৃত হবে। খালি রাখলে স্বয়ংক্রিয়ভাবে তৈরি হবে।
            </p>
            <div className="flex flex-col gap-4">
              <MLInput label="মেটা টাইটেল" value={form.meta_title} onChange={(v) => set("meta_title", v)} />
              <MLInput label="মেটা ডেসক্রিপশন" textarea rows={2} value={form.meta_description} onChange={(v) => set("meta_description", v)} />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-line bg-white/80 p-4 backdrop-blur-sm">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-[10px] border border-line bg-white px-6 py-3 text-[14.5px] font-semibold text-ink-mute"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-[10px] bg-brand-600 px-6 py-3 text-[14.5px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </div>

      {/* Quick-add modals — one component per shape, wired to matching action. */}
      {modal?.kind === "hospital" && (
        <QuickAddModal
          title="নতুন হাসপাতাল যোগ করুন"
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            const res = await quickCreateHospital(name);
            if (!res.ok) return { ok: false, message: res.message };
            setHospitals((prev) => [
              ...prev,
              { id: res.row.id, name_bn: res.row.name_bn, name_en: res.row.name_en },
            ]);
            set("hospital_id", res.row.id);
            setModal(null);
            return { ok: true };
          }}
        />
      )}
      {modal?.kind === "specialty" && (
        <QuickAddModal
          title="নতুন বিভাগ যোগ করুন"
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            const res = await quickCreateSpecialty(name);
            if (!res.ok) return { ok: false, message: res.message };
            setSpecialties((prev) => [
              ...prev,
              { id: res.row.id, name_bn: res.row.name_bn, name_en: res.row.name_en },
            ]);
            set("specialty_ids", [...form.specialty_ids, res.row.id]);
            setModal(null);
            return { ok: true };
          }}
        />
      )}
      {modal?.kind === "district" && (
        <QuickAddModal
          title="নতুন জেলা যোগ করুন"
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            const res = await quickCreateDistrict(name);
            if (!res.ok) return { ok: false, message: res.message };
            setDistricts((prev) => [
              ...prev,
              { id: res.row.id, name_bn: res.row.name_bn, name_en: res.row.name_en },
            ]);
            const idx = modal.chamberIndex;
            setChamber(idx, { district_id: res.row.id, area_id: null });
            setModal(null);
            return { ok: true };
          }}
        />
      )}
      {modal?.kind === "area" && (
        <QuickAddModal
          title="নতুন থানা / উপজেলা যোগ করুন"
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            const res = await quickCreateArea({ ...name, district_id: modal.districtId });
            if (!res.ok) return { ok: false, message: res.message };
            const dist = districts.find((d) => d.id === modal.districtId);
            setAreas((prev) => [
              ...prev,
              {
                id: res.row.id,
                name_bn: res.row.name_bn,
                name_en: res.row.name_en,
                district_id: modal.districtId,
                district_bn: dist?.name_bn ?? null,
                district_en: dist?.name_en ?? null,
              },
            ]);
            setChamber(modal.chamberIndex, { area_id: res.row.id });
            setModal(null);
            return { ok: true };
          }}
        />
      )}
    </div>
  );
}
