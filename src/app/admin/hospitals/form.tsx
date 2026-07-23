"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { saveHospital } from "@/actions/admin-content";
import { quickCreateArea, quickCreateDistrict, quickCreateSpecialty } from "@/actions/admin-quick-create";
import { Field, inputCls, Toggle, Toast, ImageUpload, MLInput } from "@/components/admin/ui";
import { SearchableSelect, SearchableMultiSelect, QuickAddModal, type Option } from "@/components/admin/searchable-select";
import { toML, emptyML, type ML } from "@/lib/utils";
import { parseLatLng } from "@/lib/map-coords";

type SpecialtyOpt = { id: number; name_bn: string; name_en: string | null };
type AreaOpt = {
  id: number; name_bn: string; name_en: string | null;
  district_id: number | null; district_bn: string | null; district_en: string | null;
};
type DistrictOpt = { id: number; name_bn: string; name_en: string | null };

export type HospitalDraft = {
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

export const EMPTY_HOSPITAL: HospitalDraft = {
  slug: "", name: { ...emptyML },
  district_id: null, area_id: null,
  address: { ...emptyML }, phone: "",
  lat: "", lng: "", description: { ...emptyML }, departments: [],
  map_url: "",
  meta_title: { ...emptyML }, meta_description: { ...emptyML }, active: true,
  image_url: null, gallery: [],
};

type ModalMode = { kind: "district" } | { kind: "area"; districtId: number } | { kind: "specialty" };

function specialtiesToDepartments(specs: SpecialtyOpt[], ids: number[]): ML[] {
  return ids
    .map((id) => specs.find((s) => s.id === id))
    .filter((x): x is SpecialtyOpt => !!x)
    .map((s) => ({ bn: s.name_bn, en: s.name_en || "" }));
}

function departmentsToIds(specs: SpecialtyOpt[], deps: ML[]): number[] {
  const out: number[] = [];
  for (const d of deps) {
    const bn = d.bn?.trim() ?? "";
    const en = d.en?.trim() ?? "";
    const hit = specs.find((s) => (bn && s.name_bn === bn) || (en && s.name_en === en));
    if (hit) out.push(hit.id);
  }
  return out;
}


export function HospitalForm({
  initial,
  areas: initialAreas,
  specialties: initialSpecialties,
  districts: initialDistricts,
  onFinished,
}: {
  initial: HospitalDraft;
  areas: AreaOpt[];
  specialties: SpecialtyOpt[];
  districts: DistrictOpt[];
  onFinished: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [draft, setDraft] = useState(initial);
  const [imageData, setImageData] = useState<string | undefined>();
  const [removeImage, setRemoveImage] = useState(false);
  const [galleryAdd, setGalleryAdd] = useState<string[]>([]);
  const [galleryRemove, setGalleryRemove] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState(initialSpecialties);
  const [districts, setDistricts] = useState(initialDistricts);
  const [areas, setAreas] = useState(initialAreas);
  const [modal, setModal] = useState<ModalMode | null>(null);

  const submit = () => {
    startTransition(async () => {
      const res = await saveHospital({
        ...draft,
        lat: draft.lat === "" ? null : Number(draft.lat),
        lng: draft.lng === "" ? null : Number(draft.lng),
        departments: draft.departments.filter((dep) => dep.bn.trim() || dep.en.trim()),
        image_data: imageData,
        remove_image: removeImage,
        gallery_add: galleryAdd,
        gallery_remove: galleryRemove,
      });
      setResult(res);
      if (res.ok) {
        onFinished();
      }
    });
  };

  const specialtyOptions: Option[] = useMemo(
    () => specialties.map((s) => ({ id: s.id, label: s.name_bn, label_en: s.name_en })),
    [specialties]
  );
  const districtOptions: Option[] = useMemo(
    () => districts.map((d) => ({ id: d.id, label: d.name_bn, label_en: d.name_en })),
    [districts]
  );

  const selectedSpecIds = useMemo(
    () => departmentsToIds(specialties, draft.departments),
    [specialties, draft.departments]
  );

  const areasForDistrict = (districtId: number | null): Option[] =>
    (districtId ? areas.filter((a) => a.district_id === districtId) : []).map((a) => ({
      id: a.id,
      label: a.name_bn,
      label_en: a.name_en,
      sub: a.district_bn ?? undefined,
    }));

  return (
    <div className="relative">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white p-4 sm:p-5">
        <h2 className="font-heading text-xl font-bold text-ink">
          {draft.id ? "হাসপাতাল এডিট" : "নতুন হাসপাতাল"}
        </h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onFinished} className="rounded-[10px] border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-mute hover:bg-slate-50 transition-colors">
            বাতিল
          </button>
          <button type="button" onClick={submit} disabled={pending} className="rounded-[10px] bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60 transition-colors">
            {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
          <div className="h-6 w-px bg-line mx-1" />
          <button type="button" onClick={onFinished} aria-label="Close" className="rounded-full p-2 text-ink-ghost transition-colors hover:bg-slate-100 hover:text-ink">
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Scrollable form content */}
      <div className="p-6 pb-28">
        <Toast result={result} />
        <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
                <div>
                    <ImageUpload
                        currentUrl={removeImage ? null : draft.image_url}
                        label="প্রধান ছবি"
                        aspect="aspect-[4/3]"
                        onChange={(data) => { setImageData(data); setRemoveImage(false); }}
                        onRemove={() => { setImageData(undefined); setRemoveImage(true); }}
                    />
                    <div className="mt-3">
                        <div className="mb-1.5 text-[13px] font-semibold text-ink-soft">গ্যালারি</div>
                        <div className="grid grid-cols-3 gap-2">
                        {draft.gallery
                            .filter((g) => !galleryRemove.includes(g.key))
                            .map((g) => (
                            <div key={g.key} className="group relative aspect-square overflow-hidden rounded-lg border border-line">
                                <Image src={g.url} alt="" fill sizes="80px" className="object-cover" />
                                <button
                                type="button"
                                onClick={() => setGalleryRemove([...galleryRemove, g.key])}
                                className="absolute inset-0 hidden items-center justify-center bg-ink/60 text-xs font-bold text-white group-hover:flex"
                                >
                                মুছুন
                                </button>
                            </div>
                            ))}
                        {galleryAdd.map((dataUrl, i) => (
                            <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-brand-200">
                            <img src={dataUrl} alt="" className="h-full w-full object-cover" />
                            </div>
                        ))}
                        </div>
                        <label className="mt-2 inline-block cursor-pointer text-[12.5px] font-semibold text-brand-600">
                        + গ্যালারিতে ছবি যোগ করুন
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                            for (const file of Array.from(e.target.files || [])) {
                                const reader = new FileReader();
                                reader.onload = () => setGalleryAdd((prev) => [...prev, String(reader.result)]);
                                reader.readAsDataURL(file);
                            }
                            e.target.value = "";
                            }}
                        />
                        </label>
                    </div>
                </div>
                <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
                    <MLInput label="নাম" required value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
                    <MLInput label="ঠিকানা" value={draft.address} onChange={(v) => setDraft({ ...draft, address: v })} />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="জেলা" hint="আগে জেলা বাছুন, পরে সেই জেলার থানা / উপজেলা তালিকায় আসবে।">
                        <SearchableSelect
                            options={districtOptions}
                            value={draft.district_id}
                            onChange={(id) => setDraft({ ...draft, district_id: id, area_id: null })}
                            placeholder="জেলা নির্বাচন করুন"
                            addLabel="+ নতুন জেলা"
                            onAddClick={() => setModal({ kind: "district" })}
                            emptyLabel="কোনো জেলা নেই"
                        />
                        </Field>
                        <Field label="থানা / উপজেলা">
                        <SearchableSelect
                            options={areasForDistrict(draft.district_id)}
                            value={draft.area_id}
                            onChange={(id) => setDraft({ ...draft, area_id: id })}
                            placeholder={draft.district_id ? "থানা / উপজেলা নির্বাচন করুন" : "প্রথমে জেলা বাছুন"}
                            addLabel="+ নতুন থানা / উপজেলা"
                            onAddClick={
                                draft.district_id
                                ? () => setModal({ kind: "area", districtId: draft.district_id! })
                                : undefined
                            }
                            disabled={!draft.district_id}
                            emptyLabel="কোনো থানা নেই"
                        />
                        </Field>
                        <Field label="Slug (URL)">
                        <input className={inputCls + " font-latin"} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
                        </Field>
                        <Field label="ফোন">
                        <input className={inputCls + " font-latin"} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                        </Field>
                    </div>
                    <Toggle checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} label="সক্রিয়" />
                </div>
            </div>
            
            <div className="rounded-2xl border border-line bg-white p-6">
                <MLInput
                    label="বর্ণনা"
                    richText
                    value={draft.description}
                    onChange={(v) => setDraft({ ...draft, description: v })}
                    hint="বোল্ড, লিস্ট, শিরোনাম ইত্যাদি ব্যবহার করে বিস্তারিত বর্ণনা লিখুন।"
                />
            </div>
            <div className="rounded-2xl border border-line bg-white p-6">
                <Field
                    label="বিভাগসমূহ"
                    hint="যেসব বিভাগে এই হাসপাতালে সেবা আছে সেগুলো নির্বাচন করুন। তালিকায় না থাকলে সাথে সাথে যোগ করুন।"
                >
                    <SearchableMultiSelect
                    options={specialtyOptions}
                    value={selectedSpecIds}
                    onChange={(ids) =>
                        setDraft({ ...draft, departments: specialtiesToDepartments(specialties, ids) })
                    }
                    placeholder="বিভাগ নির্বাচন করুন"
                    addLabel="+ নতুন বিভাগ যোগ করুন"
                    onAddClick={() => setModal({ kind: "specialty" })}
                    emptyLabel="কোনো বিভাগ নেই"
                    />
                </Field>
            </div>

            <div className="rounded-2xl border border-line bg-white p-6">
                <Field
                    label="গুগল ম্যাপ (ঐচ্ছিক)"
                    hint="সম্পূর্ণ <iframe ...> ট্যাগ বা শুধু URL — যেকোনোটা paste করুন।"
                >
                    <textarea
                    rows={3}
                    className={inputCls + " font-latin resize-y"}
                    value={draft.map_url}
                    onChange={(e) => {
                        const nextUrl = e.target.value;
                        const coords = parseLatLng(nextUrl);
                        if (coords) {
                        setDraft({ ...draft, map_url: nextUrl, lat: String(coords.lat), lng: String(coords.lng) });
                        } else if (!nextUrl.trim()) {
                        setDraft({ ...draft, map_url: nextUrl, lat: "", lng: "" });
                        } else {
                        setDraft({ ...draft, map_url: nextUrl });
                        }
                    }}
                    placeholder='<iframe src="https://www.google.com/maps/embed?pb=..." ...></iframe>'
                    />
                </Field>
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <Field label="Latitude" hint="ম্যাপ URL থেকে অটো-এক্সট্র্যাক্ট হয়েছে; দরকার হলে এডিট করুন।">
                    <input
                        type="number"
                        step="any"
                        className={inputCls + " font-latin"}
                        value={draft.lat}
                        onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
                        placeholder="22.821203"
                    />
                    </Field>
                    <Field label="Longitude" hint="ম্যাপ URL থেকে অটো-এক্সট্র্যাক্ট হয়েছে; দরকার হলে এডিট করুন।">
                    <input
                        type="number"
                        step="any"
                        className={inputCls + " font-latin"}
                        value={draft.lng}
                        onChange={(e) => setDraft({ ...draft, lng: e.target.value })}
                        placeholder="89.538703"
                    />
                    </Field>
                </div>
            </div>

            <div className="rounded-2xl border border-line bg-white p-6">
                <MLInput label="মেটা টাইটেল (SEO)" value={draft.meta_title} onChange={(v) => setDraft({ ...draft, meta_title: v })} />
                <MLInput label="মেটা ডেসক্রিপশন (SEO)" value={draft.meta_description} onChange={(v) => setDraft({ ...draft, meta_description: v })} />
            </div>
        </div>
      </div>
      
      {/* Sticky Footer */}
      <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-line bg-white/80 p-4 backdrop-blur-sm">
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onFinished} className="rounded-[10px] border border-line bg-white px-6 py-3 text-[14.5px] font-semibold text-ink-mute">
            বাতিল
          </button>
          <button type="button" onClick={submit} disabled={pending} className="rounded-[10px] bg-brand-600 px-6 py-3 text-[14.5px] font-bold text-white hover:bg-brand-700 disabled:opacity-60">
            {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </div>

      {modal?.kind === "specialty" && (
        <QuickAddModal
          title="নতুন বিভাগ যোগ করুন"
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            const res = await quickCreateSpecialty(name);
            if (!res.ok) return { ok: false, message: res.message };
            const fresh: SpecialtyOpt = { id: res.row.id, name_bn: res.row.name_bn, name_en: res.row.name_en };
            setSpecialties((prev) => [...prev, fresh]);
            setDraft({
                ...draft,
                departments: [...draft.departments, { bn: fresh.name_bn, en: fresh.name_en || "" }],
            });
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
            const fresh: DistrictOpt = { id: res.row.id, name_bn: res.row.name_bn, name_en: res.row.name_en };
            setDistricts((prev) => [...prev, fresh]);
            setDraft({ ...draft, district_id: res.row.id, area_id: null });
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
            const parent = districts.find((d) => d.id === modal.districtId);
            const fresh: AreaOpt = {
              id: res.row.id, name_bn: res.row.name_bn, name_en: res.row.name_en,
              district_id: modal.districtId,
              district_bn: parent?.name_bn ?? null,
              district_en: parent?.name_en ?? null,
            };
            setAreas((prev) => [...prev, fresh]);
            setDraft({ ...draft, area_id: res.row.id });
            setModal(null);
            return { ok: true };
          }}
        />
      )}
    </div>
  );
}
