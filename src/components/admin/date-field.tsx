"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { inputCls } from "@/components/admin/ui";

// Date input that always reads dd/mm/yyyy.
//
// A native <input type="date"> renders in the BROWSER's locale — on an en-US
// machine that is mm/dd/yyyy, and no HTML or CSS can override it. So the field
// the admin reads and types into is a plain text box we format ourselves,
// while a hidden native input is kept alongside purely to supply the OS date
// picker. Value in and out is always ISO yyyy-mm-dd, so callers and the
// database never see the display format.

const pad = (n: number) => String(n).padStart(2, "0");

export function isoToDmy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// Returns ISO only for a real calendar date — 31/02/2026 is rejected rather
// than silently rolling over into March, which would save a date the admin
// never chose.
export function dmyToIso(dmy: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = Number(dd), mo = Number(mm), y = Number(yyyy);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

export function DateField({
  value,
  onChange,
  label,
}: {
  /** ISO yyyy-mm-dd, or "" */
  value: string;
  onChange: (iso: string) => void;
  label: string;
}) {
  const [text, setText] = useState(() => isoToDmy(value));
  const picker = useRef<HTMLInputElement>(null);

  // Follow the value when it changes from outside (loading an existing record),
  // but never while the admin is mid-keystroke on a partial date.
  useEffect(() => {
    const asIso = dmyToIso(text);
    if (asIso !== value) setText(isoToDmy(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const type = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(out);
    const iso = dmyToIso(out);
    if (iso) onChange(iso);
    else if (out === "") onChange("");
  };

  const invalid = text.length === 10 && dmyToIso(text) === null;

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-mute">{label}</span>
      <div className="relative">
        <input
          value={text}
          onChange={(e) => type(e.target.value)}
          placeholder="dd/mm/yyyy"
          inputMode="numeric"
          aria-invalid={invalid}
          className={`${inputCls} pr-11 ${invalid ? "border-[#DC2626]" : ""}`}
        />
        <button
          type="button"
          aria-label="ক্যালেন্ডার"
          onClick={() => {
            const el = picker.current;
            if (!el) return;
            // showPicker() is the only way to open the native calendar without
            // showing the input itself; older browsers just get focus.
            if (typeof el.showPicker === "function") el.showPicker();
            else el.focus();
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-ghost transition hover:bg-page hover:text-ink"
        >
          <CalendarDays size={17} />
        </button>
        <input
          ref={picker}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-3 h-0 w-0 opacity-0"
        />
      </div>
      {invalid && <span className="mt-1 block text-xs text-[#DC2626]">সঠিক তারিখ দিন (dd/mm/yyyy)</span>}
    </label>
  );
}
