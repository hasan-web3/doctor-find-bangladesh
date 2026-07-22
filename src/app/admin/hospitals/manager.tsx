"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { saveHospital, deleteHospital } from "@/actions/admin-content";
import { quickCreateArea, quickCreateDistrict, quickCreateSpecialty } from "@/actions/admin-quick-create";
import { Field, inputCls, Toggle, Toast, StatusBadge, ConfirmButton, ImageUpload, MLInput } from "@/components/admin/ui";
import { SearchableSelect, SearchableMultiSelect, QuickAddModal, type Option } from "@/components/admin/searchable-select";
import { toML, emptyML, type ML } from "@/lib/utils";
import { parseLatLng } from "@/lib/map-coords";

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

const EMPTY: Draft = {
  slug: "", name: { ...emptyML },
  district_id: null, area_id: null,
  address: { ...emptyML }, phone: "",
  lat: "", lng: "", description: { ...emptyML }, departments: [],
  map_url: "",
  meta_title: { ...emptyML }, meta_description: { ...emptyML }, active: true,
  image_url: null, gallery: [],
};

// Quick-add modal target — which entity is being created.
type ModalMode = { kind: "district" } | { kind: "area"; districtId: number } | { kind: "specialty" };

// Match a saved department ML to a specialty by exact name — falls back to id
// lookup on subsequent renders once the specialty list is loaded.
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

export function HospitalsManager({
  rows,
  areas: initialAreas,
  specialties: initialSpecialties,
  districts: initialDistricts,
}: {
  rows: HospitalRow[];
  areas: AreaOpt[];
  specialties: SpecialtyOpt[];
  districts: DistrictOpt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [imageData, setImageData] = useState<string | undefined>();
  const [removeImage, setRemoveImage] = useState(false);
  const [galleryAdd, setGalleryAdd] = useState<string[]>([]);
  const [galleryRemove, setGalleryRemove] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState(initialSpecialties);
  const [districts, setDistricts] = useState(initialDistricts);
  const [areas, setAreas] = useState(initialAreas);
  const [modal, setModal] = useState<ModalMode | null>(null);

  const open = (draft: Draft) => {
    setEditing(draft);
    setImageData(undefined);
    setRemoveImage(false);
    setGalleryAdd([]);
    setGalleryRemove([]);
    setResult(null);
  };

  const submit = () => {
    if (!editing) return;
    startTransition(async () => {
      const res = await saveHospital({
        ...editing,
        lat: editing.lat === "" ? null : Number(editing.lat),
        lng: editing.lng === "" ? null : Number(editing.lng),
        departments: editing.departments.filter((dep) => dep.bn.trim() || dep.en.trim()),
        image_data: imageData,
        remove_image: removeImage,
        gallery_add: galleryAdd,
        gallery_remove: galleryRemove,
      });
      setResult(res);
      if (res.ok) { setEditing(null); router.refresh(); }
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
    () => (editing ? departmentsToIds(specialties, editing.departments) : []),
    [specialties, editing]
  );

  // Only thanas that belong to the currently-picked district. Sub-select from
  // the full `areas` list so quick-add can top it up without a full refetch.
  const areasForDistrict = (districtId: number | null): Option[] =>
    (districtId ? areas.filter((a) => a.district_id === districtId) : []).map((a) => ({
      id: a.id,
      label: a.name_bn,
      label_en: a.name_en,
      sub: a.district_bn ?? undefined,
    }));

  return (
    <div>
      <Toast result={result} />
      <div className="mb-4 flex justify-end">
        <button onClick={() => open({ ...EMPTY })} className="rounded-[10px] bg-brand-600 px-[18px] py-2.5 text-sm font-bold text-white hover:bg-brand-700">
          + নতুন হাসপাতাল / New Hospital
        </button>
      </div>

      {editing && (
        <div className="mb-5 rounded-2xl border border-brand-200 bg-white p-6">
          <div className="mb-4 font-heading text-base font-bold text-ink">
            {editing.id ? "হাসপাতাল এডিট / Edit Hospital" : "নতুন হাসপাতাল / New Hospital"}
          </div>
          <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-[220px_1fr]">
            <div>
              <ImageUpload
                currentUrl={removeImage ? null : editing.image_url}
                label="প্রধান ছবি / Main image"
                aspect="aspect-[4/3]"
                onChange={(data) => { setImageData(data); setRemoveImage(false); }}
                onRemove={() => { setImageData(undefined); setRemoveImage(true); }}
              />
              <div className="mt-3">
                <div className="mb-1.5 text-[13px] font-semibold text-ink-soft">গ্যালারি / Gallery</div>
                <div className="grid grid-cols-3 gap-2">
                  {editing.gallery
                    .filter((g) => !galleryRemove.includes(g.key))
                    .map((g) => (
                      <div key={g.key} className="group relative aspect-square overflow-hidden rounded-lg border border-line">
                        <Image src={g.url} alt="" fill sizes="80px" className="object-cover" />
                        <button
                          type="button"
                          onClick={() => setGalleryRemove([...galleryRemove, g.key])}
                          className="absolute inset-0 hidden items-center justify-center bg-ink/60 text-xs font-bold text-white group-hover:flex"
                        >
                          মুছুন / Remove
                        </button>
                      </div>
                    ))}
                  {galleryAdd.map((dataUrl, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-brand-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={dataUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
                <label className="mt-2 inline-block cursor-pointer text-[12.5px] font-semibold text-brand-600">
                  + গ্যালারিতে ছবি যোগ করুন / Add image
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

            <div className="flex flex-col gap-4">
              <MLInput label="নাম / Name" required value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
              <MLInput label="ঠিকানা / Address" value={editing.address} onChange={(v) => setEditing({ ...editing, address: v })} />
              {/* District → Thana cascade — same behaviour as the doctor form's
                  chamber section. Thana list is scoped to the chosen district
                  and stays disabled until one is picked. Both selects offer
                  "+ নতুন" quick-add modals so admin never leaves this form. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="জেলা / District" hint="আগে জেলা বাছুন, পরে সেই জেলার থানা / উপজেলা তালিকায় আসবে।">
                  <SearchableSelect
                    options={districtOptions}
                    value={editing.district_id}
                    onChange={(id) => setEditing({ ...editing, district_id: id, area_id: null })}
                    placeholder="জেলা নির্বাচন করুন / Select district"
                    addLabel="+ নতুন জেলা / New district"
                    onAddClick={() => setModal({ kind: "district" })}
                    emptyLabel="কোনো জেলা নেই"
                  />
                </Field>
                <Field label="থানা / উপজেলা / Thana / Upazila">
                  <SearchableSelect
                    options={areasForDistrict(editing.district_id)}
                    value={editing.area_id}
                    onChange={(id) => setEditing({ ...editing, area_id: id })}
                    placeholder={editing.district_id ? "থানা / উপজেলা নির্বাচন করুন / Select thana" : "প্রথমে জেলা বাছুন / Pick district first"}
                    addLabel="+ নতুন থানা / উপজেলা / New thana"
                    onAddClick={
                      editing.district_id
                        ? () => setModal({ kind: "area", districtId: editing.district_id! })
                        : undefined
                    }
                    disabled={!editing.district_id}
                    emptyLabel="কোনো থানা নেই"
                  />
                </Field>
                <Field label="Slug (URL)">
                  <input className={inputCls + " font-latin"} value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
                </Field>
                <Field label="ফোন / Phone">
                  <input className={inputCls + " font-latin"} value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
                </Field>
              </div>

              {/* Rich text description — same editor as doctor bio */}
              <MLInput
                label="বর্ণনা / Description"
                richText
                value={editing.description}
                onChange={(v) => setEditing({ ...editing, description: v })}
                hint="বোল্ড, লিস্ট, শিরোনাম ইত্যাদি ব্যবহার করে বিস্তারিত বর্ণনা লিখুন / Use bold, lists, headings for a richer description."
              />

              {/* Departments — searchable multi-select bound to the specialties table */}
              <Field
                label="বিভাগসমূহ / Departments"
                hint="যেসব বিভাগে এই হাসপাতালে সেবা আছে সেগুলো নির্বাচন করুন। তালিকায় না থাকলে সাথে সাথে যোগ করুন।"
              >
                <SearchableMultiSelect
                  options={specialtyOptions}
                  value={selectedSpecIds}
                  onChange={(ids) =>
                    setEditing({ ...editing, departments: specialtiesToDepartments(specialties, ids) })
                  }
                  placeholder="বিভাগ নির্বাচন করুন / Pick departments"
                  addLabel="+ নতুন বিভাগ যোগ করুন / Add specialty"
                  onAddClick={() => setModal({ kind: "specialty" })}
                  emptyLabel="কোনো বিভাগ নেই / No specialties"
                />
              </Field>

              {/* Google Maps — accepts full iframe tag OR just URL.
                  Lat/Lng inputs live directly below so admins see the pair
                  they belong to; onChange re-extracts coords from the URL so
                  the fields auto-fill on paste and re-sync on any edit. */}
              <Field
                label="গুগল ম্যাপ / Google Map (ঐচ্ছিক / optional)"
                hint="সম্পূর্ণ <iframe ...> ট্যাগ বা শুধু URL — যেকোনোটা paste করুন। server auto-extract করে শুধু map link সংরক্ষণ করবে। / Paste either the full iframe tag or just the URL."
              >
                <textarea
                  rows={3}
                  className={inputCls + " font-latin resize-y"}
                  value={editing.map_url}
                  onChange={(e) => {
                    // Any URL change re-syncs lat/lng from the new URL:
                    //   • URL yields coords → overwrite lat/lng
                    //   • URL cleared      → clear lat/lng
                    //   • Unresolvable URL → keep whatever was typed (short
                    //     links like maps.app.goo.gl don't carry coords)
                    const nextUrl = e.target.value;
                    const coords = parseLatLng(nextUrl);
                    if (coords) {
                      setEditing({ ...editing, map_url: nextUrl, lat: String(coords.lat), lng: String(coords.lng) });
                    } else if (!nextUrl.trim()) {
                      setEditing({ ...editing, map_url: nextUrl, lat: "", lng: "" });
                    } else {
                      setEditing({ ...editing, map_url: nextUrl });
                    }
                  }}
                  placeholder='<iframe src="https://www.google.com/maps/embed?pb=..." ...></iframe>  বা / or  https://maps.app.goo.gl/xxx'
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude" hint="ম্যাপ URL থেকে অটো-এক্সট্র্যাক্ট হয়েছে; দরকার হলে এডিট করুন। / Auto-extracted from map URL — edit if needed.">
                  <input
                    type="number"
                    step="any"
                    className={inputCls + " font-latin"}
                    value={editing.lat}
                    onChange={(e) => setEditing({ ...editing, lat: e.target.value })}
                    placeholder="22.821203"
                  />
                </Field>
                <Field label="Longitude" hint="ম্যাপ URL থেকে অটো-এক্সট্র্যাক্ট হয়েছে; দরকার হলে এডিট করুন। / Auto-extracted from map URL — edit if needed.">
                  <input
                    type="number"
                    step="any"
                    className={inputCls + " font-latin"}
                    value={editing.lng}
                    onChange={(e) => setEditing({ ...editing, lng: e.target.value })}
                    placeholder="89.538703"
                  />
                </Field>
              </div>

              <MLInput label="মেটা টাইটেল / Meta title (SEO)" value={editing.meta_title} onChange={(v) => setEditing({ ...editing, meta_title: v })} />
              <MLInput label="মেটা ডেসক্রিপশন / Meta description (SEO)" value={editing.meta_description} onChange={(v) => setEditing({ ...editing, meta_description: v })} />
              <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="সক্রিয় / Active" />
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={submit} disabled={pending} className="rounded-[10px] bg-brand-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {pending ? "সংরক্ষণ হচ্ছে... / Saving..." : "সংরক্ষণ করুন / Save"}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-[10px] border border-line bg-white px-6 py-2.5 text-sm text-ink-mute">
              বাতিল / Cancel
            </button>
          </div>
        </div>
      )}

      {modal?.kind === "specialty" && (
        <QuickAddModal
          title="নতুন বিভাগ যোগ করুন / New specialty"
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            const res = await quickCreateSpecialty(name);
            if (!res.ok) return { ok: false, message: res.message };
            const fresh: SpecialtyOpt = { id: res.row.id, name_bn: res.row.name_bn, name_en: res.row.name_en };
            setSpecialties((prev) => [...prev, fresh]);
            if (editing) {
              setEditing({
                ...editing,
                departments: [...editing.departments, { bn: fresh.name_bn, en: fresh.name_en || "" }],
              });
            }
            setModal(null);
            router.refresh();
            return { ok: true };
          }}
        />
      )}
      {modal?.kind === "district" && (
        <QuickAddModal
          title="নতুন জেলা যোগ করুন / New district"
          onClose={() => setModal(null)}
          onSubmit={async (name) => {
            const res = await quickCreateDistrict(name);
            if (!res.ok) return { ok: false, message: res.message };
            const fresh: DistrictOpt = { id: res.row.id, name_bn: res.row.name_bn, name_en: res.row.name_en };
            setDistricts((prev) => [...prev, fresh]);
            if (editing) setEditing({ ...editing, district_id: res.row.id, area_id: null });
            setModal(null);
            router.refresh();
            return { ok: true };
          }}
        />
      )}
      {modal?.kind === "area" && (
        <QuickAddModal
          title="নতুন থানা / উপজেলা যোগ করুন / New thana"
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
            if (editing) setEditing({ ...editing, area_id: res.row.id });
            setModal(null);
            router.refresh();
            return { ok: true };
          }}
        />
      )}

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
            {rows.map((h) => {
              const name = toML(h.name);
              return (
                <tr key={h.id}>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-sm font-semibold text-ink">{name.bn}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 font-latin text-[13px] text-ink-mute">{name.en || "..."}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3 text-[13.5px] text-ink-mute">{h.area_bn || "..."}</td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <StatusBadge tone={h.active ? "green" : "gray"}>{h.active ? "সক্রিয়" : "নিষ্ক্রিয়"}</StatusBadge>
                  </td>
                  <td className="border-b border-[#F1F5F9] px-3.5 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => open({
                          id: h.id, slug: h.slug, name: toML(h.name),
                          // Pre-fill district from the joined `area_district_id` so the thana
                          // dropdown starts populated with the correct list.
                          district_id: h.area_district_id,
                          area_id: h.area_id,
                          address: toML(h.address), phone: h.phone || "",
                          lat: h.lat != null ? String(h.lat) : "", lng: h.lng != null ? String(h.lng) : "",
                          description: toML(h.description),
                          departments: Array.isArray(h.departments) ? (h.departments as unknown[]).map(toML) : [],
                          map_url: h.map_url ?? "",
                          meta_title: toML(h.meta_title), meta_description: toML(h.meta_description),
                          active: h.active, image_url: h.image_url, gallery: h.gallery || [],
                        })}
                        className="rounded-lg border border-line bg-white px-[11px] py-1.5 text-[12.5px] font-semibold text-brand-600"
                      >
                        এডিট / Edit
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
    </div>
  );
}
