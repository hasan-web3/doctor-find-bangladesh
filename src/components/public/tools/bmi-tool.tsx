"use client";

import { useState } from "react";
import {
  BMI_ASIAN,
  BMI_GUIDANCE,
  BMI_INTERNATIONAL,
  BMI_MINOR_NOTE,
  BMI_SENIOR_NOTE,
  calcBmi,
} from "@/lib/tools/calc";
import { getToolCopy, pick } from "@/lib/tools/copy";
import { num, type Locale } from "@/lib/i18n";
import type { ToolWidgetProps } from "./tool-runner";
import {
  BandScale,
  CalcLayout,
  CountUp,
  EmptyResult,
  FieldLabel,
  HeightField,
  Notice,
  NumberInput,
  ResultPanel,
  StatTile,
  WeightField,
  heightToCm,
  initialHeight,
  initialWeight,
  useDebounced,
  weightToKg,
  type HeightState,
  type WeightState,
} from "./tool-ui";

// The visual scale runs 15 to 35 rather than 0 to 60. Almost every real result
// lands inside it, and a scale that covers the impossible range compresses the
// part that actually distinguishes one band from the next into a few pixels.
const SCALE_MIN = 15;
const SCALE_MAX = 35;

// brandName is part of the shared widget signature (see ToolWidgetProps); this
// tool has no share card yet, so it goes unused here.
export function BmiTool({ locale }: ToolWidgetProps) {
  const c = getToolCopy(locale);
  const [height, setHeight] = useState<HeightState>(initialHeight);
  const [weight, setWeight] = useState<WeightState>(initialWeight);
  const [age, setAge] = useState("");

  // Debounced so the result does not thrash while a number is half-typed —
  // "7" on the way to "70" would otherwise flash a result for a 7 kg adult.
  const debounced = useDebounced({ height, weight, age });
  const heightCm = heightToCm(debounced.height);
  const weightKg = weightToKg(debounced.weight);
  const ageNum = debounced.age ? parseInt(debounced.age, 10) : null;

  const result = heightCm && weightKg ? calcBmi({ heightCm, weightKg, age: ageNum }) : null;

  const form = (
    <div className="flex flex-col gap-4">
      <HeightField
        value={height}
        onChange={setHeight}
        locale={locale}
        labels={{
          label: c.field_height,
          cm: c.unit_cm,
          m: c.unit_m,
          ftin: c.unit_ftin,
          ft: c.unit_ft_short,
          in: c.unit_in_short,
        }}
      />
      <WeightField
        value={weight}
        onChange={setWeight}
        labels={{ label: c.field_weight, kg: c.unit_kg, lb: c.unit_lb }}
      />
      <div>
        <FieldLabel hint={c.bmi_age_hint}>{c.field_age_optional}</FieldLabel>
        <NumberInput
          value={age}
          onChange={setAge}
          suffix={c.field_age_unit}
          ariaLabel={c.field_age}
          max={3}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          setHeight(initialHeight);
          setWeight(initialWeight);
          setAge("");
        }}
        className="mt-1 self-start rounded-lg px-2 py-1 text-[13px] font-semibold text-ink-faint transition-colors hover:text-brand-700"
      >
        {c.tool_reset}
      </button>
    </div>
  );

  if (!result) {
    return <CalcLayout form={form} result={<EmptyResult text={c.tool_fill_prompt} />} />;
  }

  const g = BMI_GUIDANCE[result.asian.id];
  // Under 18 the adult bands are meaningless, so the headline drops to a
  // neutral tone and the band caption is replaced by the growth-chart note.
  const tone = result.isMinor ? "low" : result.asian.tone;

  const scaleBands = (table: typeof BMI_ASIAN) =>
    table.map((b, i) => ({
      id: b.id,
      label: pick(b.label, locale),
      tone: b.tone,
      from: i === 0 ? SCALE_MIN : b.min,
      to: b.max === null ? SCALE_MAX : b.max,
    }));

  return (
    <CalcLayout
      form={form}
      result={
        <ResultPanel resultKey={`${result.bmi}-${result.isMinor}`} className="flex flex-col gap-4">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="px-5 py-4 text-center">
              <div className="text-[13px] font-semibold text-ink-faint">{c.bmi_result_label}</div>
              <div className="mt-1 font-heading text-[clamp(44px,12vw,64px)] font-extrabold leading-none text-ink">
                <CountUp value={result.bmi} places={1} locale={locale} />
              </div>
              {!result.isMinor && (
                <div
                  className={`mt-2.5 inline-block rounded-full px-3.5 py-1 text-[14.5px] font-bold ${
                    { low: "bg-[#EFF6FF] text-[#1D4ED8]", good: "bg-accent-soft text-accent-text", warn: "bg-warm-soft text-warm-text", high: "bg-[#FFF1F2] text-[#BE123C]", critical: "bg-[#FEF2F2] text-[#B91C1C]" }[tone]
                  }`}
                >
                  {pick(result.asian.label, locale)}
                </div>
              )}
            </div>

            {/* Asian scale leads — it is the one that applies here. */}
            <div className="mt-5">
              <div className="mb-1 text-[12.5px] font-bold text-ink-soft">{c.bmi_scale_asian}</div>
              <BandScale
                bands={scaleBands(BMI_ASIAN)}
                value={result.bmi}
                min={SCALE_MIN}
                max={SCALE_MAX}
                locale={locale}
                activeId={result.isMinor ? "" : result.asian.id}
              />
            </div>

            <div className="mt-6">
              <div className="mb-1 text-[12.5px] font-bold text-ink-faint">{c.bmi_scale_intl}</div>
              <BandScale
                bands={scaleBands(BMI_INTERNATIONAL)}
                value={result.bmi}
                min={SCALE_MIN}
                max={SCALE_MAX}
                locale={locale}
                activeId={result.isMinor ? "" : result.international.id}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatTile
              label={c.bmi_healthy_range}
              value={`${num(String(result.healthyMin), locale)} – ${num(String(result.healthyMax), locale)}`}
              unit={c.unit_kg}
            />
            <StatTile
              label={
                result.delta === 0
                  ? c.bmi_delta_in
                  : result.delta > 0
                    ? c.bmi_delta_over
                    : c.bmi_delta_under
              }
              value={result.delta === 0 ? "—" : num(String(Math.abs(result.delta)), locale)}
              unit={result.delta === 0 ? undefined : c.unit_kg}
            />
          </div>

          {result.isMinor ? (
            <Notice tone="warn" title={c.tool_disclaimer_title}>
              {pick(BMI_MINOR_NOTE, locale)}
            </Notice>
          ) : (
            <>
              <Notice tone={tone} title={pick(g.head, locale)}>
                {pick(g.body, locale)}
              </Notice>
              {result.isSenior && <Notice tone="neutral">{pick(BMI_SENIOR_NOTE, locale)}</Notice>}
            </>
          )}

          <Notice tone="neutral">{c.bmi_why_two_scales}</Notice>
        </ResultPanel>
      }
    />
  );
}
