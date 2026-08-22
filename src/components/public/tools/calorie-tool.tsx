"use client";

import { useState } from "react";
import {
  ACTIVITY_LEVELS,
  CALORIE_CLAMP_NOTE,
  CALORIE_GUIDANCE,
  calcCalories,
  type CalorieGoal,
  type Sex,
} from "@/lib/tools/calc";
import { getToolCopy, pick } from "@/lib/tools/copy";
import { num, type Locale } from "@/lib/i18n";
import type { ToolWidgetProps } from "./tool-runner";
import {
  CalcLayout,
  CountUp,
  EmptyResult,
  FieldLabel,
  HeightField,
  MeterBar,
  Notice,
  NumberInput,
  OptionList,
  ResultPanel,
  Segmented,
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

export function CalorieTool({ locale }: ToolWidgetProps) {
  const c = getToolCopy(locale);
  const [sex, setSex] = useState<Sex>("male");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState<HeightState>(initialHeight);
  const [weight, setWeight] = useState<WeightState>(initialWeight);
  const [activity, setActivity] = useState(ACTIVITY_LEVELS[1].id);
  const [goal, setGoal] = useState<CalorieGoal>("maintain");

  const debounced = useDebounced({ age, height, weight });
  const heightCm = heightToCm(debounced.height);
  const weightKg = weightToKg(debounced.weight);
  const ageNum = parseInt(debounced.age, 10);
  const level = ACTIVITY_LEVELS.find((a) => a.id === activity) ?? ACTIVITY_LEVELS[1];

  const result =
    heightCm && weightKg && Number.isFinite(ageNum)
      ? calcCalories({
          sex,
          age: ageNum,
          weightKg,
          heightCm,
          activityFactor: level.factor,
          goal,
        })
      : null;

  const goalOptions: { value: CalorieGoal; label: string }[] = [
    { value: "lose", label: c.goal_lose },
    { value: "maintain", label: c.goal_maintain },
    { value: "gain", label: c.goal_gain },
  ];

  const form = (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel hint={c.sex_note}>{c.field_sex}</FieldLabel>
        <Segmented
          ariaLabel={c.field_sex}
          value={sex}
          onChange={setSex}
          options={[
            { value: "male" as const, label: c.sex_male },
            { value: "female" as const, label: c.sex_female },
          ]}
        />
      </div>
      <div>
        <FieldLabel>{c.field_age}</FieldLabel>
        <NumberInput value={age} onChange={setAge} suffix={c.field_age_unit} ariaLabel={c.field_age} max={3} />
      </div>
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
        <FieldLabel>{c.cal_field_activity}</FieldLabel>
        <OptionList
          ariaLabel={c.cal_field_activity}
          value={activity}
          onChange={setActivity}
          options={ACTIVITY_LEVELS.map((a) => ({
            value: a.id,
            label: pick(a.label, locale),
            hint: pick(a.hint, locale),
          }))}
        />
      </div>
      <div>
        <FieldLabel>{c.cal_field_goal}</FieldLabel>
        <Segmented ariaLabel={c.cal_field_goal} value={goal} onChange={setGoal} options={goalOptions} />
      </div>
    </div>
  );

  if (!result) {
    return <CalcLayout form={form} result={<EmptyResult text={c.tool_fill_prompt} />} />;
  }

  const g = CALORIE_GUIDANCE[result.goal];
  const tone = result.goal === "lose" ? "warn" : result.goal === "gain" ? "low" : "good";

  // Macro bars are drawn against calories contributed, not grams, so the three
  // bars sum to the whole plate. Drawing them by gram weight would make fat —
  // 9 kcal/g against 4 — look like a much smaller share of the diet than it is.
  const macroKcal = {
    protein: result.macros.proteinG * 4,
    carbs: result.macros.carbsG * 4,
    fat: result.macros.fatG * 9,
  };
  const macroTotal = macroKcal.protein + macroKcal.carbs + macroKcal.fat || 1;

  const macroRows: { label: string; grams: number; kcal: number; tone: "good" | "warn" | "low" }[] = [
    { label: c.macro_protein, grams: result.macros.proteinG, kcal: macroKcal.protein, tone: "good" },
    { label: c.macro_carbs, grams: result.macros.carbsG, kcal: macroKcal.carbs, tone: "warn" },
    { label: c.macro_fat, grams: result.macros.fatG, kcal: macroKcal.fat, tone: "low" },
  ];

  const maxGoal = Math.max(result.all.lose, result.all.maintain, result.all.gain) || 1;

  return (
    <CalcLayout
      form={form}
      result={
        <ResultPanel
          resultKey={`${result.target}-${result.goal}-${result.bmr}`}
          className="flex flex-col gap-4"
        >
          <div className="rounded-2xl border border-line bg-white p-5 text-center shadow-card">
            <div className="text-[13px] font-semibold text-ink-faint">{c.cal_target_label}</div>
            <div className="mt-1 font-heading text-[clamp(42px,12vw,60px)] font-extrabold leading-none text-brand-700">
              <CountUp value={result.target} locale={locale} />
            </div>
            <div className="mt-1 text-[14px] font-bold text-ink-mute">
              {c.cal_unit} · {c.cal_per_day}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatTile
              label={c.cal_bmr_label}
              value={num(String(result.bmr), locale)}
              unit={c.cal_unit_short}
              hint={c.cal_bmr_hint}
            />
            <StatTile
              label={c.cal_tdee_label}
              value={num(String(result.tdee), locale)}
              unit={c.cal_unit_short}
              hint={c.cal_tdee_hint}
            />
          </div>

          {result.clamped && (
            <Notice tone="warn" title={c.tool_disclaimer_title}>
              {pick(CALORIE_CLAMP_NOTE, locale)}
            </Notice>
          )}

          <Notice tone={tone} title={pick(g.head, locale)}>
            {pick(g.body, locale)}
          </Notice>

          {/* macros */}
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="mb-3.5 font-heading text-[15.5px] font-bold text-ink">{c.cal_macro_title}</div>
            <div className="flex flex-col gap-3.5">
              {macroRows.map((m) => (
                <div key={m.label}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-semibold text-ink-soft">{m.label}</span>
                    <span className="font-heading text-[15px] font-bold text-ink">
                      {num(String(m.grams), locale)}
                      <span className="ml-1 text-[12px] font-semibold text-ink-mute">{c.macro_gram}</span>
                    </span>
                  </div>
                  <MeterBar ratio={m.kcal / macroTotal} tone={m.tone} />
                </div>
              ))}
            </div>
            <p className="mb-0 mt-3.5 text-[12.5px] leading-relaxed text-ink-faint">{c.cal_macro_hint}</p>
          </div>

          {/* goal comparison */}
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <div className="mb-3.5 font-heading text-[15.5px] font-bold text-ink">{c.cal_compare_title}</div>
            <div className="flex flex-col gap-3">
              {goalOptions.map((o) => {
                const v = result.all[o.value];
                const active = o.value === result.goal;
                return (
                  <div key={o.value}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span
                        className={
                          active
                            ? "text-[14px] font-bold text-brand-700"
                            : "text-[14px] font-semibold text-ink-faint"
                        }
                      >
                        {o.label}
                      </span>
                      <span className="font-heading text-[15px] font-bold text-ink">
                        {num(String(v), locale)}
                        <span className="ml-1 text-[12px] font-semibold text-ink-mute">{c.cal_unit_short}</span>
                      </span>
                    </div>
                    <MeterBar ratio={v / maxGoal} tone={active ? "good" : "low"} />
                  </div>
                );
              })}
            </div>
          </div>
        </ResultPanel>
      }
    />
  );
}
