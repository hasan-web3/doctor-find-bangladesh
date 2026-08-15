"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { inputCls } from "@/components/admin/ui";

// Month input that always reads mm/yyyy.
//
// Same shape and the same reasoning as ./date-field.tsx: a native
// <input type="month"> renders in the BROWSER's locale, which no HTML or CSS
// can override, so the box the admin reads and types into is a plain text field
// we format ourselves, with a hidden native input kept alongside purely to
// supply the OS month picker. Value in and out is always "YYYY-MM".
//
// Month precision rather than a full date because that is the precision BMDC's
// own register publishes: "Reg. Valid Till 07/2029". Asking an admin for a day
// would be asking them to invent one.

export function monthToMmYyyy(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month || "");
  return m ? `${m[2]}/${m[1]}` : "";
}

// Returns "YYYY-MM" only for a real month; 13/2029 is rejected rather than
// silently rolling into the next year.
export function mmYyyyToMonth(text: string): string | null {
  const m = /^(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const mon = Number(m[1]);
  const year = Number(m[2]);
  if (mon < 1 || mon > 12 || year < 1900 || year > 2200) return null;
  return `${m[2]}-${m[1]}`;
}

export function MonthField({
  value,
  onChange,
  label,
  hint,
}: {
  /** "YYYY-MM", or "" */
  value: string;
  onChange: (month: string) => void;
  label: string;
  hint?: string;
}) {
  const [text, setText] = useState(() => monthToMmYyyy(value));
  const picker = useRef<HTMLInputElement>(null);

  // Follow the value when it changes from outside (loading an existing doctor),
  // but never while the admin is mid-keystroke on a partial month.
  useEffect(() => {
    if (mmYyyyToMonth(text) !== value) setText(monthToMmYyyy(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const type = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    const out = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
    setText(out);
    const month = mmYyyyToMonth(out);
    if (month) onChange(month);
    else if (out === "") onChange("");
  };

  const invalid = text.length === 7 && mmYyyyToMonth(text) === null;

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-mute">{label}</span>
      <div className="relative">
        <input
          value={text}
          onChange={(e) => type(e.target.value)}
          placeholder="mm/yyyy"
          inputMode="numeric"
          aria-invalid={invalid}
          className={`${inputCls} font-latin pr-11 ${invalid ? "border-[#DC2626]" : ""}`}
        />
        <button
          type="button"
          aria-label="মাস বাছুন"
          onClick={() => {
            const el = picker.current;
            if (!el) return;
            // showPicker() opens the native month picker without showing the
            // input itself; older browsers just get focus.
            if (typeof el.showPicker === "function") el.showPicker();
            else el.focus();
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-ghost transition hover:bg-page hover:text-ink"
        >
          <CalendarDays size={17} />
        </button>
        <input
          ref={picker}
          type="month"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-3 h-0 w-0 opacity-0"
        />
      </div>
      {invalid ? (
        <span className="mt-1 block text-xs text-[#DC2626]">সঠিক মাস দিন (mm/yyyy)</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-ghost">{hint}</span>
      ) : null}
    </label>
  );
}
