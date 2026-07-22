"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { fuzzyFilter } from "@/lib/fuzzy";

export type Option = { id: number; label: string; label_en?: string | null; sub?: string };

/**
 * Combobox: a searchable single-select dropdown with an optional inline
 * "+ add new" trigger. Bilingual — types either the Bangla or English name to
 * find an item, and typos within 1–2 edits are still surfaced (see lib/fuzzy).
 * Renders left-aligned in the natural document flow.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "নির্বাচন করুন",
  addLabel = "+ নতুন যোগ করুন",
  onAddClick,
  emptyLabel = "কোনো ফলাফল নেই",
  disabled = false,
  searchable = true,
  ariaLabel,
}: {
  options: Option[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  addLabel?: string;
  onAddClick?: () => void;
  emptyLabel?: string;
  disabled?: boolean;
  searchable?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(
    () => searchable ? fuzzyFilter(options, q, (o) => [o.label, o.label_en, o.sub]) : options,
    [q, options, searchable]
  );

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-sm text-ink transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : "hover:border-brand-300"
        }`}
      >
        <span className={`truncate ${selected ? "text-ink" : "text-ink-ghost"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-ink-ghost">▾</span>
      </button>

      {open && !disabled && (
        <div className="absolute left-0 z-40 mt-1 w-full min-w-[240px] rounded-xl border border-line bg-white shadow-[0_12px_30px_rgba(15,23,42,.12)]">
          {searchable && (
            <div className="border-b border-line p-2">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="খুঁজুন / Search..."
                className="w-full rounded-md border border-line bg-page px-2.5 py-1.5 text-left text-sm outline-none focus:border-brand-500 focus:bg-white"
              />
            </div>
          )}
          <div className="max-h-[260px] overflow-y-auto py-1">
            {filtered.length > 0 ? (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                    setQ("");
                  }}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50 ${
                    o.id === value ? "bg-brand-50 font-semibold text-brand-700" : "text-ink"
                  }`}
                >
                  <span className="flex-1 truncate">
                    {o.label}
                    {o.label_en && <span className="ml-1.5 font-latin text-[12px] text-ink-ghost">· {o.label_en}</span>}
                  </span>
                  {o.sub && <span className="text-[12px] text-ink-ghost">{o.sub}</span>}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-xs text-ink-ghost">{emptyLabel}</div>
            )}
          </div>
          {onAddClick && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQ("");
                onAddClick();
              }}
              className="block w-full border-t border-line bg-brand-50 px-3 py-2.5 text-left text-sm font-semibold text-brand-700 hover:bg-brand-100"
            >
              {addLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Multi-select variant: same look, tags for chosen items above the trigger.
 * The trigger shows a count when items are picked. First item is treated as
 * primary and rendered as a filled brand chip (with a caller-provided hint).
 */
export function SearchableMultiSelect({
  options,
  value,
  onChange,
  placeholder = "নির্বাচন করুন",
  addLabel = "+ নতুন যোগ করুন",
  onAddClick,
  emptyLabel = "কোনো ফলাফল নেই",
  primaryHint,
}: {
  options: Option[];
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  addLabel?: string;
  onAddClick?: () => void;
  emptyLabel?: string;
  primaryHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(
    () => fuzzyFilter(options, q, (o) => [o.label, o.label_en, o.sub]),
    [q, options]
  );

  const [parent] = useAutoAnimate();

  const selected = value
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is Option => Boolean(o));

  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div ref={wrapRef} className="flex flex-col">
      {selected.length > 0 && (
        <div ref={parent} className="order-1 mb-2 flex flex-wrap items-center gap-1.5 md:order-2 md:mb-0 md:mt-2">
          {selected.map((o, i) => (
            <span
              key={o.id}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${
                i === 0 ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"
              }`}
            >
              {i === 0 && primaryHint && <span className="text-[10px] opacity-80">{primaryHint}</span>}
              {o.label}
              <button
                type="button"
                onClick={() => toggle(o.id)}
                aria-label="remove"
                className="opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative order-2 md:order-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-sm text-ink hover:border-brand-300"
        >
          <span className={selected.length ? "text-ink" : "text-ink-ghost"}>
            {selected.length > 0 ? `${selected.length} টি নির্বাচিত` : placeholder}
          </span>
          <span className="text-ink-ghost">▾</span>
        </button>

        {open && (
          <div className="absolute left-0 z-40 mt-1 w-full min-w-[260px] rounded-xl border border-line bg-white shadow-[0_12px_30px_rgba(15,23,42,.12)]">
            <div className="border-b border-line p-2">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="খুঁজুন / Search..."
                className="w-full rounded-md border border-line bg-page px-2.5 py-1.5 text-left text-sm outline-none focus:border-brand-500 focus:bg-white"
              />
            </div>
            <div className="max-h-[260px] overflow-y-auto py-1">
              {filtered.length > 0 ? (
                filtered.map((o) => {
                  const on = value.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(o.id)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                        on ? "bg-brand-50 font-semibold text-brand-700" : "text-ink hover:bg-brand-50"
                      }`}
                    >
                      <span className={`h-4 w-4 shrink-0 rounded border ${on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white"} flex items-center justify-center text-[11px]`}>
                        {on ? "✓" : ""}
                      </span>
                      <span className="flex-1 truncate">
                        {o.label}
                        {o.label_en && <span className="ml-1.5 font-latin text-[12px] text-ink-ghost">· {o.label_en}</span>}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-center text-xs text-ink-ghost">{emptyLabel}</div>
              )}
            </div>
            {onAddClick && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQ("");
                  onAddClick();
                }}
                className="block w-full border-t border-line bg-brand-50 px-3 py-2.5 text-left text-sm font-semibold text-brand-700 hover:bg-brand-100"
              >
                {addLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * QuickAddModal: bn+en name fields (both required for consistency across
 * languages) plus an optional extra slot. onSubmit runs the create action;
 * on ok the parent closes the modal with the returned option data.
 */
export function QuickAddModal({
  title,
  onClose,
  onSubmit,
  extra,
  submitLabel = "যোগ করুন",
}: {
  title: string;
  onClose: () => void;
  onSubmit: (name: { bn: string; en: string }) => Promise<{ ok: boolean; message?: string }>;
  extra?: ReactNode;
  submitLabel?: string;
}) {
  const [bn, setBn] = useState("");
  const [en, setEn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!bn.trim() || !en.trim()) {
      setError("বাংলা ও ইংরেজি — দুটো নামই দিতে হবে");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await onSubmit({ bn: bn.trim(), en: en.trim() });
    setBusy(false);
    if (!res.ok) setError(res.message || "সংরক্ষণ ব্যর্থ");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,.25)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="m-0 font-heading text-lg font-bold text-ink">{title}</h3>
          <button type="button" onClick={onClose} aria-label="close" className="text-ink-ghost hover:text-ink">✕</button>
        </div>

        {extra}

        <div className="mb-3">
          <label className="mb-1.5 block text-[12.5px] font-bold text-brand-600">বাংলা নাম *</label>
          <input
            autoFocus
            value={bn}
            onChange={(e) => setBn(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-left text-sm outline-none focus:border-brand-500"
          />
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-[12.5px] font-bold text-brand-600">English name *</label>
          <input
            value={en}
            onChange={(e) => setEn(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-left font-latin text-sm outline-none focus:border-brand-500"
            placeholder="Required for search & URLs"
          />
        </div>

        {error && <div className="mb-3 rounded-lg bg-warm-soft px-3 py-2 text-[13px] font-semibold text-warm-heavy">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-white px-4 py-2 text-sm text-ink-mute"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !bn.trim() || !en.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
