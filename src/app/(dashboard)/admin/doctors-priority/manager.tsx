"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import { FullPageModal } from "@/components/admin/full-page-modal";
import { Toggle, StatusBadge, Toast, inputCls } from "@/components/admin/ui";
import { DateField, isoToDmy } from "@/components/admin/date-field";
import { fuzzyFilter } from "@/lib/fuzzy";
import { bnNum, bnDuration } from "@/lib/bn";
import {
  listDistrictDoctors,
  saveDistrictPriority,
  savePriorityPromotion,
  toggleDistrictPriority,
  type PriorityDistrictRow,
  type PriorityDoctorRow,
} from "@/actions/admin-priority";

const PLANS: { value: "basic" | "featured" | "premium"; label: string }[] = [
  { value: "basic", label: "বেসিক" },
  { value: "featured", label: "ফিচার্ড" },
  { value: "premium", label: "প্রিমিয়াম" },
];

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// Payment dialog for one pinned doctor. No doctor picker (the row the admin
// clicked IS the doctor) and no status field (it is derived from the dates).
function PromotionDialog({
  doc,
  onClose,
  onSaved,
  onResult,
}: {
  doc: PriorityDoctorRow;
  onClose: () => void;
  onSaved: () => void;
  onResult: (r: { ok: boolean; message: string } | null) => void;
}) {
  const [plan, setPlan] = useState(doc.promo_plan ?? "featured");
  const [amount, setAmount] = useState(String(doc.promo_amount ?? 0));
  const [startsOn, setStartsOn] = useState(doc.promo_starts_on ?? today());
  const [endsOn, setEndsOn] = useState(doc.promo_ends_on ?? plusDays(30));
  const [notes, setNotes] = useState(doc.promo_notes ?? "");
  const [pending, startTransition] = useTransition();
  const duration = useMemo(() => bnDuration(startsOn, endsOn), [startsOn, endsOn]);

  const submit = () => {
    startTransition(async () => {
      const res = await savePriorityPromotion({
        doctorId: doc.id,
        id: doc.promo_id,
        plan,
        amount: Number(amount) || 0,
        starts_on: startsOn,
        ends_on: endsOn,
        notes,
      });
      onResult(res);
      if (res.ok) {
        onSaved();
        onClose();
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-[980px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="m-0 font-heading text-lg font-bold text-ink">{doc.name_bn}</h3>
            <p className="mt-1 text-xs text-ink-faint">
              {[doc.specialty_bn, doc.place_bn].filter(Boolean).join(" • ") || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="rounded-full p-2 text-ink-ghost transition hover:bg-page hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-mute">প্ল্যান</span>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as typeof plan)}
              className={inputCls}
            >
              {PLANS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-mute">পরিমাণ (টাকা)</span>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
            />
          </label>
          <DateField label="শুরুর তারিখ" value={startsOn} onChange={setStartsOn} />
          <DateField label="মেয়াদ শেষ" value={endsOn} onChange={setEndsOn} />
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-ink-mute">নোট (ঐচ্ছিক)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="বিকাশ / নগদ / ক্যাশ..."
              className={inputCls}
            />
          </label>
        </div>

        {/* Reads back the span the two dates actually add up to, so a mistyped
            year or a reversed range is obvious before saving. */}
        <div className="mt-3 text-[13px]">
          {duration ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-page px-3 py-1.5 font-semibold text-ink-mute">
              মেয়াদ: <span className="text-brand-700">{duration}</span>
            </span>
          ) : startsOn && endsOn ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#FEF2F2] px-3 py-1.5 font-semibold text-[#DC2626]">
              মেয়াদ শেষের তারিখ শুরুর তারিখের আগে হতে পারে না।
            </span>
          ) : null}
        </div>

        <p className="mt-4 rounded-xl bg-brand-50 p-3 text-[13px] leading-relaxed text-brand-700">
          শুরুর তারিখ থেকে মেয়াদ শেষ পর্যন্ত এই ডাক্তার এই জেলার ক্রম অনুযায়ী সাইটে আগে
          দেখাবেন। মেয়াদ শেষ হলে স্বয়ংক্রিয়ভাবে ক্রম থেকে বাদ পড়বেন — আলাদা করে বন্ধ
          করতে হবে না। প্ল্যান শুধু হিসাব রাখার জন্য, এটি সাইটে কোনো নিয়ম প্রয়োগ করে না।
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-mute transition hover:bg-page"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Entry = { doctorId: number; enabled: boolean };

export function PriorityManager({ districts }: { districts: PriorityDistrictRow[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<PriorityDistrictRow | null>(null);
  const [rows, setRows] = useState<PriorityDistrictRow[]>(districts);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => setRows(districts), [districts]);

  const filtered = useMemo(
    () => fuzzyFilter(rows, q, (r) => [r.name_bn, r.name_en, r.slug]),
    [rows, q]
  );

  // Keep the card in sync after the drawer saves, so counts and the master
  // switch do not need a full page reload to look right.
  const patchRow = useCallback((id: number, patch: Partial<PriorityDistrictRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setOpen((cur) => (cur && cur.id === id ? { ...cur, ...patch } : cur));
  }, []);

  return (
    <div>
      <Toast result={result} />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="জেলা খুঁজুন (বাংলা বা English)..."
        className={`${inputCls} mb-4 max-w-[420px]`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setOpen(row)}
            className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 text-left transition hover:border-brand-300 hover:shadow-sm"
          >
            <div className="min-w-0">
              <div className="truncate font-heading text-[15px] font-bold text-ink">{row.name_bn}</div>
              <div className="mt-0.5 text-xs text-ink-faint">
                {bnNum(row.doctor_count)} জন ডাক্তার
                {row.pinned_count > 0 && ` • ${bnNum(row.pinned_count)} জন ক্রমে`}
              </div>
            </div>
            <StatusBadge tone={row.priority_enabled ? "green" : "gray"}>
              {row.priority_enabled ? "চালু" : "বন্ধ"}
            </StatusBadge>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-faint">
            কোনো জেলা পাওয়া যায়নি।
          </div>
        )}
      </div>

      <FullPageModal
        isOpen={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `${open.name_bn} — ডাক্তারের ক্রম` : ""}
      >
        {open && (
          <DistrictPanel
            key={open.id}
            district={open}
            onPatch={patchRow}
            onResult={setResult}
            onClose={() => setOpen(null)}
          />
        )}
      </FullPageModal>
    </div>
  );
}

function DistrictPanel({
  district,
  onPatch,
  onResult,
  onClose,
}: {
  district: PriorityDistrictRow;
  onPatch: (id: number, patch: Partial<PriorityDistrictRow>) => void;
  onResult: (r: { ok: boolean; message: string } | null) => void;
  onClose: () => void;
}) {
  const [doctors, setDoctors] = useState<PriorityDoctorRow[] | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [masterOn, setMasterOn] = useState(district.priority_enabled);
  const [payFor, setPayFor] = useState<PriorityDoctorRow | null>(null);
  const dragFrom = useRef<number | null>(null);

  const load = useCallback(() => {
    return listDistrictDoctors(district.id).then((rows) => {
      setDoctors(rows);
      setEntries(
        rows
          .filter((r) => r.position !== null)
          .map((r) => ({ doctorId: r.id, enabled: r.enabled ?? true }))
      );
      return rows;
    });
  }, [district.id]);

  useEffect(() => {
    let alive = true;
    listDistrictDoctors(district.id).then((rows) => {
      if (!alive) return;
      setDoctors(rows);
      setEntries(
        rows
          .filter((r) => r.position !== null)
          .map((r) => ({ doctorId: r.id, enabled: r.enabled ?? true }))
      );
    });
    return () => {
      alive = false;
    };
  }, [district.id]);

  const byId = useMemo(() => new Map((doctors ?? []).map((d) => [d.id, d])), [doctors]);
  const pinnedIds = useMemo(() => new Set(entries.map((e) => e.doctorId)), [entries]);

  const unpinned = useMemo(() => {
    const rest = (doctors ?? []).filter((d) => !pinnedIds.has(d.id));
    return fuzzyFilter(rest, q, (d) => [d.name_bn, d.specialty_bn, d.place_bn, d.slug]);
  }, [doctors, pinnedIds, q]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= entries.length || from === to) return;
    setEntries((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setDirty(true);
  };

  const add = (doctorId: number) => {
    setEntries((prev) => [...prev, { doctorId, enabled: true }]);
    setDirty(true);
  };

  const remove = (doctorId: number) => {
    setEntries((prev) => prev.filter((e) => e.doctorId !== doctorId));
    setDirty(true);
  };

  const setEnabled = (doctorId: number, enabled: boolean) => {
    setEntries((prev) => prev.map((e) => (e.doctorId === doctorId ? { ...e, enabled } : e)));
    setDirty(true);
  };

  const save = () => {
    startTransition(async () => {
      const res = await saveDistrictPriority({ districtId: district.id, entries });
      onResult(res);
      if (res.ok) {
        setDirty(false);
        onPatch(district.id, { pinned_count: entries.filter((e) => e.enabled).length });
      }
    });
  };

  const toggleMaster = (v: boolean) => {
    setMasterOn(v);
    startTransition(async () => {
      const res = await toggleDistrictPriority({ districtId: district.id, enabled: v });
      onResult(res);
      if (res.ok) onPatch(district.id, { priority_enabled: v });
      else setMasterOn(!v);
    });
  };

  return (
    <div className="mx-auto max-w-[900px] p-4 sm:p-6">
      {/* master switch */}
      <div className="mb-5 rounded-xl border border-line bg-white p-4">
        <Toggle checked={masterOn} onChange={toggleMaster} label="এই জেলার ক্রম চালু" />
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          বন্ধ থাকলে নিচের ক্রম সংরক্ষিত থাকবে কিন্তু সাইটে প্রয়োগ হবে না — সব ডাক্তার
          আগের নিয়মেই (এলাকা ও দূরত্ব অনুযায়ী) সাজবে।
        </p>
      </div>

      {doctors === null ? (
        <div className="py-10 text-center text-sm text-ink-faint">লোড হচ্ছে…</div>
      ) : (
        <>
          {/* ---- curated order ---- */}
          <div className="mb-2 flex items-center justify-between">
            <h3 className="m-0 font-heading text-base font-bold text-ink">
              ক্রম ({bnNum(entries.length)})
            </h3>
            {dirty && (
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {pending ? "সংরক্ষণ হচ্ছে…" : "ক্রম সংরক্ষণ করুন"}
              </button>
            )}
          </div>

          {entries.length === 0 ? (
            <div className="mb-6 rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
              এখনো কোনো ডাক্তার ক্রমে যোগ করা হয়নি। নিচের তালিকা থেকে যোগ করুন।
            </div>
          ) : (
            <ul className="mb-6 flex list-none flex-col gap-2 p-0">
              {entries.map((e, i) => {
                const doc = byId.get(e.doctorId);
                if (!doc) return null;
                return (
                  <li
                    key={e.doctorId}
                    draggable
                    onDragStart={() => (dragFrom.current = i)}
                    onDragOver={(ev) => ev.preventDefault()}
                    onDrop={() => {
                      if (dragFrom.current !== null) move(dragFrom.current, i);
                      dragFrom.current = null;
                    }}
                    className={`flex items-center gap-3 rounded-xl border bg-white p-3 ${
                      doc.active ? "border-line" : "border-dashed border-line opacity-60"
                    }`}
                  >
                    <span className="cursor-grab text-ink-ghost" aria-hidden>
                      <GripVertical size={16} />
                    </span>
                    <span className="w-6 shrink-0 text-center text-xs font-bold text-ink-ghost">
                      {bnNum(i + 1)}
                    </span>
                    <DoctorLabel doc={doc} onOpen={() => setPayFor(doc)} enabled={e.enabled} />
                    {/* Arrows exist because drag-and-drop is mouse-only; this
                        panel has to be usable on a touch screen too. */}
                    <div className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        aria-label="উপরে"
                        onClick={() => move(i, i - 1)}
                        disabled={i === 0}
                        className="rounded p-0.5 text-ink-ghost transition hover:bg-page hover:text-ink disabled:opacity-30"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="নিচে"
                        onClick={() => move(i, i + 1)}
                        disabled={i === entries.length - 1}
                        className="rounded p-0.5 text-ink-ghost transition hover:bg-page hover:text-ink disabled:opacity-30"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-ink-mute">
                      <input
                        type="checkbox"
                        checked={e.enabled}
                        onChange={(ev) => setEnabled(e.doctorId, ev.target.checked)}
                        className="h-4 w-4 accent-brand-600"
                      />
                      সক্রিয়
                    </label>
                    <button
                      type="button"
                      aria-label="ক্রম থেকে সরান"
                      onClick={() => remove(e.doctorId)}
                      className="shrink-0 rounded-full p-1 text-ink-ghost transition hover:bg-page hover:text-ink"
                    >
                      <X size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* ---- everyone else ---- */}
          <h3 className="mb-2 mt-0 font-heading text-base font-bold text-ink">
            এই জেলার বাকি ডাক্তার ({bnNum(unpinned.length)})
          </h3>
          <input
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            placeholder="ডাক্তার খুঁজুন..."
            className={`${inputCls} mb-3`}
          />
          <ul className="flex list-none flex-col gap-2 p-0">
            {unpinned.map((doc) => (
              <li
                key={doc.id}
                className={`flex items-center gap-3 rounded-xl border bg-white p-3 ${
                  doc.active ? "border-line" : "border-dashed border-line opacity-60"
                }`}
              >
                <DoctorLabel doc={doc} onOpen={() => setPayFor(doc)} />
                <button
                  type="button"
                  onClick={() => add(doc.id)}
                  className="shrink-0 rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50"
                >
                  + ক্রমে যোগ
                </button>
              </li>
            ))}
            {unpinned.length === 0 && (
              <li className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
                {q ? "এই নামে কোনো ডাক্তার পাওয়া যায়নি।" : "এই জেলার সব ডাক্তার ক্রমে আছে।"}
              </li>
            )}
          </ul>

          {payFor && (
            <PromotionDialog
              doc={payFor}
              onClose={() => setPayFor(null)}
              onSaved={() => void load()}
              onResult={onResult}
            />
          )}

          <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-line bg-page py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-mute transition hover:bg-page"
            >
              বন্ধ করুন
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending || !dirty}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? "সংরক্ষণ হচ্ছে…" : "ক্রম সংরক্ষণ করুন"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DoctorLabel({
  doc,
  onOpen,
  enabled,
}: {
  doc: PriorityDoctorRow;
  onOpen: () => void;
  /** Pinned rows pass their live checkbox state; undefined for unpinned rows. */
  enabled?: boolean;
}) {
  // Switched off by hand: the window may still be running, but nothing is being
  // served from it, so the date is shown greyed rather than hidden. Removing it
  // would lose the one piece of information the admin needs to decide whether
  // to switch the doctor back on.
  const muted = enabled === false;
  const expired = Boolean(doc.promo_ends_on) && !doc.promo_live;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left transition hover:bg-page"
      title="পেমেন্ট ও মেয়াদ"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="truncate text-[14px] font-semibold text-ink">{doc.name_bn}</span>
        {!doc.active && <StatusBadge tone="amber">অপ্রকাশিত</StatusBadge>}
        {doc.verified && doc.active && <StatusBadge tone="blue">ভেরিফায়েড</StatusBadge>}
        {doc.promo_ends_on && (
          <span className={muted ? "opacity-40 blur-[0.3px] grayscale" : ""}>
            <StatusBadge tone={muted ? "gray" : expired ? "red" : "green"}>
              {expired ? "মেয়াদ শেষ" : `মেয়াদ ${isoToDmy(doc.promo_ends_on)}`}
            </StatusBadge>
          </span>
        )}
      </div>
      <div className="mt-0.5 truncate text-xs text-ink-faint">
        {[doc.specialty_bn, doc.place_bn].filter(Boolean).join(" • ") || "—"}
      </div>
    </button>
  );
}
