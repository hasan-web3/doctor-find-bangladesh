"use client";

// ---------------------------------------------------------------------------
// Shared building blocks for every calculator on /tools.
// ---------------------------------------------------------------------------
// Deliberately dependency-free: no chart library, no animation library, no
// date picker. Everything here is a handful of divs plus CSS transitions, so
// the whole tools section adds a few kilobytes to the bundle rather than a few
// hundred. These pages are fully static and their only job is to be fast on a
// mid-range Android phone on a 3G connection.
//
// Every animation respects prefers-reduced-motion. globals.css already kills
// CSS transitions under that query, and the JS count-up below checks it too —
// without that check the numbers would still animate for someone who asked the
// system not to.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import { num, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/tools/calc";

// ---------------------------------------------------------------------------
// tone palette — one place, so a "warn" result looks the same in every tool
// ---------------------------------------------------------------------------

export const TONE: Record<Tone, { bg: string; soft: string; text: string; ring: string }> = {
  low: { bg: "bg-[#3B82F6]", soft: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", ring: "ring-[#BFDBFE]" },
  good: { bg: "bg-accent", soft: "bg-accent-soft", text: "text-accent-text", ring: "ring-[#A7F3D0]" },
  warn: { bg: "bg-warm", soft: "bg-warm-soft", text: "text-warm-text", ring: "ring-warm-border" },
  high: { bg: "bg-[#F43F5E]", soft: "bg-[#FFF1F2]", text: "text-[#BE123C]", ring: "ring-[#FECDD3]" },
  critical: { bg: "bg-[#DC2626]", soft: "bg-[#FEF2F2]", text: "text-[#B91C1C]", ring: "ring-[#FECACA]" },
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---------------------------------------------------------------------------
// useCountUp — animates a number from its previous value to the new one.
// ---------------------------------------------------------------------------
// The point is not decoration: a result that lands instantly reads as a page
// that was always there, while one that counts up reads as an answer that was
// just worked out. It also draws the eye to the number that matters when a
// visitor recalculates with different inputs.
export function useCountUp(value: number, places = 0, ms = 650): number {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    if (prefersReducedMotion()) {
      fromRef.current = to;
      setShown(to);
      return;
    }

    const start = performance.now();
    const f = 10 ** places;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      // easeOutCubic: fast first, settles gently on the final digit.
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round((from + (to - from) * eased) * f) / f);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [value, places, ms]);

  return shown;
}

/** A number that counts up, printed in the locale's own digits. */
export function CountUp({
  value,
  places = 0,
  locale,
  className,
}: {
  value: number;
  places?: number;
  locale: Locale;
  className?: string;
}) {
  const shown = useCountUp(value, places);
  return <span className={className}>{num(shown.toFixed(places), locale)}</span>;
}

// ---------------------------------------------------------------------------
// form primitives
// ---------------------------------------------------------------------------

export const fieldCls =
  "w-full rounded-xl border border-line bg-white px-[14px] py-[12px] text-[15.5px] text-ink outline-none transition-colors focus:border-brand-600 focus:ring-4 focus:ring-brand-50";

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <span className="block text-[13.5px] font-bold text-ink-soft">{children}</span>
      {hint && <span className="mt-0.5 block text-[12.5px] font-normal leading-snug text-ink-faint">{hint}</span>}
    </div>
  );
}

/**
 * Numeric input.
 *
 * `inputMode="decimal"` matters more than it looks: on Android it brings up the
 * number pad instead of the full keyboard, which is most of the difference
 * between a tool that gets used on a phone and one that gets abandoned.
 *
 * type="text" rather than type="number" on purpose — number inputs silently
 * swallow values on some Android keyboards, scroll-wheel over them changes the
 * value by accident, and their spinner arrows are dead weight here.
 */
export function NumberInput({
  value,
  onChange,
  placeholder,
  suffix,
  ariaLabel,
  max = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  ariaLabel?: string;
  max?: number;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          // Digits and at most one dot. Rejecting at the keystroke keeps the
          // parse downstream trivial and means no error state is ever needed
          // for "you typed a letter".
          const next = e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
          onChange(next.slice(0, max));
        }}
        className={cn(fieldCls, suffix && "pr-14")}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-ink-ghost">
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Pill segmented control. Used for units, sex, goal — anything with 2-5 options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex w-full flex-wrap gap-1 rounded-xl border border-line bg-page p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-[9px] font-semibold transition-all duration-150 active:scale-[0.97]",
              size === "sm" ? "px-2.5 py-1.5 text-[12.5px]" : "px-3 py-2 text-[13.5px]",
              active
                ? "bg-white text-brand-700 shadow-[0_1px_4px_rgba(15,23,42,0.10)]"
                : "text-ink-faint hover:text-ink-soft",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Vertical option list with a hint line — for activity levels and similar. */
export function OptionList<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-col gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-150 active:scale-[0.99]",
              active
                ? "border-brand-600 bg-brand-50 ring-2 ring-brand-100"
                : "border-line bg-white hover:border-brand-300",
            )}
          >
            <span
              className={cn(
                "mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                active ? "border-brand-600" : "border-line",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full transition-transform duration-150",
                  active ? "scale-100 bg-brand-600" : "scale-0 bg-transparent",
                )}
              />
            </span>
            <span className="min-w-0">
              <span className={cn("block text-[14.5px] font-semibold", active ? "text-brand-700" : "text-ink-soft")}>
                {o.label}
              </span>
              {o.hint && <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-faint">{o.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// result presentation
// ---------------------------------------------------------------------------

/**
 * The result panel.
 *
 * Keyed by `resultKey` so React remounts it whenever the answer changes, which
 * restarts the entry animation — recalculating then visibly produces a new
 * answer instead of silently swapping digits the visitor may not notice.
 */
export function ResultPanel({
  children,
  resultKey,
  className,
}: {
  children: React.ReactNode;
  resultKey: string | number;
  className?: string;
}) {
  return (
    <div key={resultKey} className={cn("animate-content-in", className)}>
      {children}
    </div>
  );
}

/** The big number at the top of a result. */
export function HeadlineStat({
  label,
  value,
  unit,
  tone,
  caption,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  tone: Tone;
  caption?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={cn("rounded-2xl px-5 py-6 text-center ring-1", t.soft, t.ring)}>
      <div className="text-[13px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={cn("mt-1 font-heading text-[clamp(40px,11vw,58px)] font-extrabold leading-none", t.text)}>
        {value}
        {unit && <span className="ml-1.5 align-middle text-[0.42em] font-bold">{unit}</span>}
      </div>
      {caption && <div className={cn("mt-2 text-[15px] font-bold", t.text)}>{caption}</div>}
    </div>
  );
}

/** A small labelled figure. Used in rows of two or three under the headline. */
export function StatTile({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-3.5">
      <div className="text-[12.5px] font-semibold text-ink-faint">{label}</div>
      <div className="mt-0.5 font-heading text-[22px] font-bold leading-tight text-ink">
        {value}
        {unit && <span className="ml-1 text-[13px] font-semibold text-ink-mute">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11.5px] leading-snug text-ink-ghost">{hint}</div>}
    </div>
  );
}

/**
 * Banded scale with a marker showing where the visitor landed.
 *
 * Segments are sized by their real numeric width between `min` and `max`, not
 * spread evenly — an evenly-spread scale would make the healthy band look
 * wider than it is and misrepresent how close a number sits to the next band.
 */
export function BandScale({
  bands,
  value,
  min,
  max,
  locale,
  activeId,
}: {
  bands: { id: string; label: string; tone: Tone; from: number; to: number }[];
  value: number;
  min: number;
  max: number;
  locale: Locale;
  activeId: string;
}) {
  const span = max - min;
  const pct = (n: number) => ((Math.min(max, Math.max(min, n)) - min) / span) * 100;
  const [markerPct, setMarkerPct] = useState(0);

  // Grow from the left edge on mount rather than snapping into place, so the
  // marker's arrival reads as the result being placed on the scale.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setMarkerPct(pct(value));
      return;
    }
    const id = requestAnimationFrame(() => setMarkerPct(pct(value)));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, min, max]);

  return (
    <div>
      <div className="relative pt-7">
        {/* marker */}
        <div
          className="absolute top-0 z-10 -translate-x-1/2 transition-[left] duration-700 ease-out"
          style={{ left: `${markerPct}%` }}
        >
          <div className="rounded-md bg-ink px-1.5 py-0.5 font-heading text-[11.5px] font-bold text-white">
            {num(String(value), locale)}
          </div>
          <div className="mx-auto h-0 w-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-ink" />
        </div>
        {/* bands */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full">
          {bands.map((b) => (
            <div
              key={b.id}
              className={cn(
                "h-full transition-opacity duration-300",
                TONE[b.tone].bg,
                b.id === activeId ? "opacity-100" : "opacity-30",
              )}
              style={{ width: `${pct(b.to) - pct(b.from)}%` }}
              title={b.label}
            />
          ))}
        </div>
      </div>
      {/* legend */}
      <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5">
        {bands.map((b) => (
          <span
            key={b.id}
            className={cn(
              "flex items-center gap-1.5 text-[11.5px]",
              b.id === activeId ? "font-bold text-ink-soft" : "text-ink-ghost",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", TONE[b.tone].bg, b.id === activeId ? "" : "opacity-40")} />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bar that grows on mount. Used for macros and goal comparisons. */
export function MeterBar({
  ratio,
  tone = "good",
  className,
}: {
  ratio: number;
  tone?: Tone;
  className?: string;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const target = Math.min(1, Math.max(0, ratio)) * 100;
    if (prefersReducedMotion()) {
      setW(target);
      return;
    }
    const id = requestAnimationFrame(() => setW(target));
    return () => cancelAnimationFrame(id);
  }, [ratio]);

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-line", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", TONE[tone].bg)}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

/** Callout box. `tone` drives the colour; `title` is optional. */
export function Notice({
  tone,
  title,
  children,
  icon,
}: {
  tone: Tone | "neutral";
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const palette =
    tone === "neutral"
      ? { soft: "bg-page", text: "text-ink-soft", ring: "ring-line" }
      : { soft: TONE[tone].soft, text: TONE[tone].text, ring: TONE[tone].ring };
  return (
    <div className={cn("rounded-xl px-4 py-3.5 ring-1", palette.soft, palette.ring)}>
      {title && (
        <div className={cn("mb-1 flex items-center gap-2 text-[14px] font-bold", palette.text)}>
          {icon}
          {title}
        </div>
      )}
      <div className="text-[14px] leading-[1.75] text-ink-mute">{children}</div>
    </div>
  );
}

/** The two-column shell every calculator uses: inputs left, result right. */
export function CalcLayout({ form, result }: { form: React.ReactNode; result: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-card lg:sticky lg:top-24">{form}</div>
      <div className="min-w-0">{result}</div>
    </div>
  );
}

/** Placeholder shown in the result column before there is anything to show. */
export function EmptyResult({ text }: { text: string }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-line bg-white/60 px-6 text-center">
      <p className="m-0 max-w-[280px] text-[14.5px] leading-relaxed text-ink-ghost">{text}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// height / weight inputs with unit switching
// ---------------------------------------------------------------------------
// Bangladeshi visitors quote height in feet and inches and weight in kg almost
// without exception, so those are the defaults — but a cm field is what most
// calculators offer, and pounds show up often enough to be worth supporting.
//
// Switching units CONVERTS the value rather than clearing it. Clearing is the
// common shortcut and it is the wrong one: someone who typed 70 kg and then
// wanted to see it in pounds gets an empty box and has to start again.

export type HeightState = { unit: "cm" | "ftin" | "m"; primary: string; inches: string };
export type WeightState = { unit: "kg" | "lb"; value: string };

export const initialHeight: HeightState = { unit: "ftin", primary: "", inches: "" };
export const initialWeight: WeightState = { unit: "kg", value: "" };

const n = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};

export function heightToCm(h: HeightState): number {
  if (h.unit === "cm") return n(h.primary);
  if (h.unit === "m") return n(h.primary) * 100;
  return n(h.primary) * 30.48 + n(h.inches) * 2.54;
}

export function weightToKg(w: WeightState): number {
  return w.unit === "lb" ? n(w.value) / 2.2046226218 : n(w.value);
}

function cmToState(cm: number, unit: HeightState["unit"]): HeightState {
  if (!cm) return { unit, primary: "", inches: unit === "ftin" ? "" : "" };
  if (unit === "cm") return { unit, primary: String(Math.round(cm)), inches: "" };
  if (unit === "m") return { unit, primary: (cm / 100).toFixed(2), inches: "" };
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  // 5'12" is not a height anybody writes.
  if (inch === 12) {
    ft += 1;
    inch = 0;
  }
  return { unit, primary: String(ft), inches: String(inch) };
}

export function HeightField({
  value,
  onChange,
  locale: _locale,
  labels,
}: {
  value: HeightState;
  onChange: (v: HeightState) => void;
  locale: Locale;
  labels: { label: string; cm: string; m: string; ftin: string; ft: string; in: string };
}) {
  const switchUnit = (unit: HeightState["unit"]) => {
    if (unit === value.unit) return;
    onChange(cmToState(heightToCm(value), unit));
  };

  return (
    <div>
      <FieldLabel>{labels.label}</FieldLabel>
      <div className="mb-2">
        <Segmented
          size="sm"
          ariaLabel={labels.label}
          value={value.unit}
          onChange={switchUnit}
          options={[
            { value: "ftin" as const, label: labels.ftin },
            { value: "cm" as const, label: labels.cm },
            { value: "m" as const, label: labels.m },
          ]}
        />
      </div>
      {value.unit === "ftin" ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            value={value.primary}
            onChange={(v) => onChange({ ...value, primary: v })}
            suffix={labels.ft}
            ariaLabel={`${labels.label} ${labels.ft}`}
            max={2}
          />
          <NumberInput
            value={value.inches}
            onChange={(v) => onChange({ ...value, inches: v })}
            suffix={labels.in}
            ariaLabel={`${labels.label} ${labels.in}`}
            max={4}
          />
        </div>
      ) : (
        <NumberInput
          value={value.primary}
          onChange={(v) => onChange({ ...value, primary: v })}
          suffix={value.unit === "cm" ? "cm" : "m"}
          ariaLabel={labels.label}
          max={value.unit === "m" ? 4 : 3}
        />
      )}
    </div>
  );
}

export function WeightField({
  value,
  onChange,
  labels,
}: {
  value: WeightState;
  onChange: (v: WeightState) => void;
  labels: { label: string; kg: string; lb: string };
}) {
  const switchUnit = (unit: WeightState["unit"]) => {
    if (unit === value.unit) return;
    const kg = weightToKg(value);
    if (!kg) {
      onChange({ unit, value: "" });
      return;
    }
    onChange({ unit, value: (unit === "lb" ? kg * 2.2046226218 : kg).toFixed(1).replace(/\.0$/, "") });
  };

  return (
    <div>
      <FieldLabel>{labels.label}</FieldLabel>
      <div className="mb-2">
        <Segmented
          size="sm"
          ariaLabel={labels.label}
          value={value.unit}
          onChange={switchUnit}
          options={[
            { value: "kg" as const, label: labels.kg },
            { value: "lb" as const, label: labels.lb },
          ]}
        />
      </div>
      <NumberInput
        value={value.value}
        onChange={(v) => onChange({ ...value, value: v })}
        suffix={value.unit}
        ariaLabel={labels.label}
        max={5}
      />
    </div>
  );
}

/** Shared "is this form ready" helper so every tool debounces the same way. */
export function useDebounced<T>(value: T, ms = 180): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Stable key for <ResultPanel>, so identical results do not re-animate. */
export function useResultKey(parts: (string | number | null | undefined)[]): string {
  return useMemo(() => parts.join("|"), [parts]);
}
