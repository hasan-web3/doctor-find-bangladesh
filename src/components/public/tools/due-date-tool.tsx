"use client";

import { useState } from "react";
import {
  ANC_CONTACTS,
  DEFAULT_CYCLE,
  DUE_DATE_ACCURACY_NOTE,
  TRIMESTER_NOTE,
  addDays,
  calcDueDate,
} from "@/lib/tools/calc";
import { getToolCopy, pick } from "@/lib/tools/copy";
import { date as fmtDate, num, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  CalcLayout,
  CountUp,
  EmptyResult,
  FieldLabel,
  MeterBar,
  Notice,
  NumberInput,
  ResultPanel,
  StatTile,
  fieldCls,
  useDebounced,
} from "./tool-ui";

/** `YYYY-MM-DD` from an <input type="date"> to a local-midnight Date. */
function parseDateInput(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  // Built from parts, not `new Date(v)`: the string form is parsed as UTC, so
  // in Bangladesh (UTC+6) every date would come back as the previous day.
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayInput(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function DueDateTool({ locale }: { locale: Locale }) {
  const c = getToolCopy(locale);
  const [lmp, setLmp] = useState("");
  const [cycle, setCycle] = useState(String(DEFAULT_CYCLE));

  const debounced = useDebounced({ lmp, cycle });
  const lmpDate = parseDateInput(debounced.lmp);
  const cycleNum = parseInt(debounced.cycle, 10);

  const outcome = lmpDate
    ? calcDueDate({
        lmp: lmpDate,
        cycleLength: Number.isFinite(cycleNum) ? cycleNum : DEFAULT_CYCLE,
      })
    : null;

  const form = (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel hint={c.dd_field_lmp_hint}>{c.dd_field_lmp}</FieldLabel>
        <input
          type="date"
          value={lmp}
          max={todayInput()}
          onChange={(e) => setLmp(e.target.value)}
          aria-label={c.dd_field_lmp}
          className={fieldCls}
        />
      </div>
      <div>
        <FieldLabel hint={c.dd_field_cycle_hint}>{c.dd_field_cycle}</FieldLabel>
        <NumberInput
          value={cycle}
          onChange={setCycle}
          suffix={c.dd_field_cycle_unit}
          ariaLabel={c.dd_field_cycle}
          max={2}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          setLmp("");
          setCycle(String(DEFAULT_CYCLE));
        }}
        className="mt-1 self-start rounded-lg px-2 py-1 text-[13px] font-semibold text-ink-faint transition-colors hover:text-brand-700"
      >
        {c.tool_reset}
      </button>
    </div>
  );

  if (!outcome) {
    return <CalcLayout form={form} result={<EmptyResult text={c.tool_fill_prompt} />} />;
  }

  if (!outcome.ok) {
    const msg =
      outcome.error === "future"
        ? c.dd_error_future
        : outcome.error === "too-old"
          ? c.dd_error_too_old
          : c.dd_error_invalid;
    return (
      <CalcLayout
        form={form}
        result={
          <ResultPanel resultKey={outcome.error}>
            <Notice tone="warn" title={c.tool_disclaimer_title}>
              {msg}
            </Notice>
          </ResultPanel>
        }
      />
    );
  }

  const r = outcome.value;
  const tNote = TRIMESTER_NOTE[r.trimester];
  const trimesterLabel = [c.dd_trimester_1, c.dd_trimester_2, c.dd_trimester_3][r.trimester - 1];

  // Contact dates are measured from the cycle-adjusted start, the same origin
  // the week count uses — otherwise a 32-day cycle would print a schedule that
  // disagreed with the "you are at N weeks" figure right above it.
  const shift = (Number.isFinite(cycleNum) ? cycleNum : DEFAULT_CYCLE) - DEFAULT_CYCLE;
  const origin = lmpDate ? addDays(lmpDate, shift) : null;
  const nextIndex = ANC_CONTACTS.findIndex((a) => a.week > r.weeks);

  return (
    <CalcLayout
      form={form}
      result={
        <ResultPanel
          resultKey={`${r.edd.getTime()}-${r.totalDays}`}
          className="flex flex-col gap-4"
        >
          <div className="rounded-2xl border border-line bg-white p-5 text-center shadow-card">
            <div className="text-[13px] font-semibold text-ink-faint">{c.dd_edd_label}</div>
            <div className="mt-1.5 font-heading text-[clamp(24px,6.5vw,34px)] font-extrabold leading-tight text-[#BE185D]">
              {fmtDate(r.edd, locale)}
            </div>
            <div className="mt-3.5">
              <div className="mb-1.5 flex items-baseline justify-between text-[12.5px] font-semibold text-ink-faint">
                <span>{c.dd_progress_label}</span>
                <span>
                  {num(String(Math.round(r.progress * 100)), locale)}%
                </span>
              </div>
              <MeterBar ratio={r.progress} tone="warn" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-3.5">
              <div className="text-[12.5px] font-semibold text-ink-faint">{c.dd_current_label}</div>
              <div className="mt-0.5 font-heading text-[22px] font-bold leading-tight text-ink">
                <CountUp value={r.weeks} locale={locale} />
                <span className="ml-1 text-[13px] font-semibold text-ink-mute">{c.dd_weeks}</span>
                {r.days > 0 && (
                  <>
                    {" "}
                    <span>{num(String(r.days), locale)}</span>
                    <span className="ml-1 text-[13px] font-semibold text-ink-mute">{c.dd_days}</span>
                  </>
                )}
              </div>
            </div>
            <StatTile
              label={c.dd_remaining}
              value={<CountUp value={Math.max(0, r.daysRemaining)} locale={locale} />}
              unit={c.dd_remaining_days}
            />
            <StatTile label={c.dd_trimester_label} value={trimesterLabel} />
            <StatTile label={c.dd_conception_label} value={fmtDate(r.conception, locale)} />
          </div>

          {r.overdue && (
            <Notice tone="critical" title={c.tool_disclaimer_title}>
              {c.dd_overdue_note}
            </Notice>
          )}

          <Notice tone="good" title={pick(tNote.head, locale)}>
            {pick(tNote.body, locale)}
          </Notice>

          {/* antenatal schedule */}
          {origin && (
            <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <div className="font-heading text-[15.5px] font-bold text-ink">{c.dd_anc_title}</div>
              <p className="mb-4 mt-1 text-[12.5px] leading-relaxed text-ink-faint">{c.dd_anc_sub}</p>
              <ol className="m-0 flex list-none flex-col gap-0 p-0">
                {ANC_CONTACTS.map((a, i) => {
                  const when = addDays(origin, a.week * 7);
                  const done = r.weeks >= a.week;
                  const isNext = i === nextIndex;
                  return (
                    <li key={a.week} className="flex gap-3">
                      {/* timeline rail */}
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "mt-1 h-3 w-3 shrink-0 rounded-full ring-4 transition-colors",
                            done
                              ? "bg-accent ring-accent-soft"
                              : isNext
                                ? "bg-warm ring-warm-soft"
                                : "bg-line ring-page",
                          )}
                        />
                        {i < ANC_CONTACTS.length - 1 && (
                          <span className={cn("w-0.5 flex-1", done ? "bg-accent/40" : "bg-line")} />
                        )}
                      </div>
                      <div className={cn("min-w-0 flex-1 pb-4", i === ANC_CONTACTS.length - 1 && "pb-0")}>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span
                            className={cn(
                              "text-[14px] font-bold",
                              isNext ? "text-warm-text" : done ? "text-ink-soft" : "text-ink-faint",
                            )}
                          >
                            {pick(a.label, locale)}
                          </span>
                          <span className="text-[12.5px] font-semibold text-ink-ghost">
                            {num(String(a.week), locale)} {c.dd_weeks}
                          </span>
                          {isNext && (
                            <span className="rounded-full bg-warm-soft px-2 py-[1px] text-[11px] font-bold text-warm-text">
                              {c.dd_anc_next}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[13px] text-ink-mute">{fmtDate(when, locale)}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          <Notice tone="critical" title={c.dd_warning_title}>
            {c.dd_warning_body}
          </Notice>

          <Notice tone="neutral">{pick(DUE_DATE_ACCURACY_NOTE, locale)}</Notice>
        </ResultPanel>
      }
    />
  );
}
