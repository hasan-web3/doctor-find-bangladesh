"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { fuzzyFilter } from "@/lib/fuzzy";

export type FilterOption = { id: number | string; label: string; sub?: string };

export function SearchableFilter({
  options,
  value,
  onChange,
  placeholder = "Select...",
  emptyLabel = "No results",
}: {
  options: FilterOption[];
  value: (string|number)[];
  onChange: (ids: (string|number)[]) => void;
  placeholder?: string;
  emptyLabel?: string;
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
    () => fuzzyFilter(options, q, (o) => [o.label, o.sub]),
    [q, options]
  );

  const [parent] = useAutoAnimate();

  const selected = value
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is FilterOption => Boolean(o));

  const toggle = (id: number | string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div ref={wrapRef} className="relative flex flex-col">
      <div className="relative order-2 md:order-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2.5 text-left text-sm text-ink hover:border-brand-300"
        >
          <span className={selected.length ? "text-ink" : "text-ink-ghost"}>
            {selected.length > 0 ? `${selected.length} selected` : placeholder}
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
                placeholder="Search..."
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
                      <span className="flex-1 truncate">{o.label}</span>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-center text-xs text-ink-ghost">{emptyLabel}</div>
              )}
            </div>
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div ref={parent} className="order-1 mb-2 flex flex-wrap items-center gap-1.5 md:order-2 md:mb-0 md:mt-2">
          {selected.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold bg-brand-50 text-brand-700"
            >
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
    </div>
  );
}
