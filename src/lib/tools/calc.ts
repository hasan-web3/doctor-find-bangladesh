// ---------------------------------------------------------------------------
// TOOL MATHS
// ---------------------------------------------------------------------------
// Pure functions. No imports, no I/O, no dates read from anywhere but the
// caller — so every one of these is trivially testable and runs entirely in the
// visitor's browser.
//
// Each formula names the standard it implements in a comment above it. Keep
// that habit: the citation is rendered on the page (see `source` in
// registry.ts), and a formula whose provenance nobody can state is exactly the
// kind of made-up health tool this section exists to not be.
// ---------------------------------------------------------------------------

export type Tone = "low" | "good" | "warn" | "high" | "critical";

export type Text = { bn: string; en: string };

// ---------------------------------------------------------------------------
// unit conversion
// ---------------------------------------------------------------------------

export const LB_PER_KG = 2.2046226218;
export const CM_PER_INCH = 2.54;
export const CM_PER_FOOT = 30.48;

export type WeightUnit = "kg" | "lb";
export type HeightUnit = "cm" | "ftin" | "m";

export function toKg(value: number, unit: WeightUnit): number {
  return unit === "lb" ? value / LB_PER_KG : value;
}

export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === "lb" ? kg * LB_PER_KG : kg;
}

/** ft + in for the split input; `inches` is ignored for cm and m. */
export function toCm(value: number, unit: HeightUnit, inches = 0): number {
  if (unit === "m") return value * 100;
  if (unit === "ftin") return value * CM_PER_FOOT + inches * CM_PER_INCH;
  return value;
}

export function round(n: number, places = 1): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// BMI
// ---------------------------------------------------------------------------
// WHO: BMI = weight(kg) / height(m)^2.
//
// TWO classifications are returned, and that is the whole point of the tool.
//
// The familiar 25/30 thresholds come from WHO's international table, which was
// derived largely from European populations. The WHO Expert Consultation
// (Lancet, 2004) found that Asian populations carry a higher proportion of body
// fat and face raised diabetes and cardiovascular risk at a BMI well below 25,
// and recommended 23 and 27.5 as additional public-health action points.
//
// For a Bangladeshi audience, showing only the international table would tell a
// large number of at-risk visitors that they are in the clear. Showing only the
// Asian table would leave them unable to reconcile the number with every other
// BMI chart they have seen. So both are shown, with the Asian one leading.
// ---------------------------------------------------------------------------

export type BmiBandId = "under" | "healthy" | "raised" | "high" | "very-high";

export type BmiBand = {
  id: BmiBandId;
  tone: Tone;
  label: Text;
  /** Inclusive lower bound; `null` on the open-ended top band. */
  min: number;
  max: number | null;
};

/** WHO Asia-Pacific action points. Leads the result. */
export const BMI_ASIAN: BmiBand[] = [
  { id: "under", tone: "low", min: 0, max: 18.5, label: { bn: "ওজন কম", en: "Underweight" } },
  { id: "healthy", tone: "good", min: 18.5, max: 23, label: { bn: "স্বাভাবিক", en: "Healthy" } },
  { id: "raised", tone: "warn", min: 23, max: 25, label: { bn: "ওজন বেশি", en: "Overweight" } },
  { id: "high", tone: "high", min: 25, max: 27.5, label: { bn: "স্থূলতা", en: "Obese" } },
  { id: "very-high", tone: "critical", min: 27.5, max: null, label: { bn: "উচ্চ স্থূলতা", en: "Severely obese" } },
];

/** WHO international table. Shown as the secondary reference. */
export const BMI_INTERNATIONAL: BmiBand[] = [
  { id: "under", tone: "low", min: 0, max: 18.5, label: { bn: "ওজন কম", en: "Underweight" } },
  { id: "healthy", tone: "good", min: 18.5, max: 25, label: { bn: "স্বাভাবিক", en: "Healthy" } },
  { id: "raised", tone: "warn", min: 25, max: 30, label: { bn: "ওজন বেশি", en: "Overweight" } },
  { id: "high", tone: "high", min: 30, max: 35, label: { bn: "স্থূলতা", en: "Obese" } },
  { id: "very-high", tone: "critical", min: 35, max: null, label: { bn: "উচ্চ স্থূলতা", en: "Severely obese" } },
];

function bandFor(bmi: number, table: BmiBand[]): BmiBand {
  for (const b of table) if (b.max === null || bmi < b.max) return b;
  return table[table.length - 1];
}

// The healthy window used for the "your healthy weight" line and the gauge.
// Asian band, deliberately: it is the one the guidance below is written against.
export const BMI_HEALTHY_MIN = 18.5;
export const BMI_HEALTHY_MAX = 22.9;

export type BmiResult = {
  bmi: number;
  asian: BmiBand;
  international: BmiBand;
  /** Healthy weight window for this height, in kg. */
  healthyMin: number;
  healthyMax: number;
  /**
   * Kilograms between the visitor's weight and the nearest edge of the healthy
   * window. Negative below it, positive above it, exactly 0 inside it.
   */
  delta: number;
  /**
   * Under 18. Adult BMI bands do not apply to children and teenagers — their
   * healthy range moves with age and sex and is read off a growth chart as a
   * percentile. The number is still shown, but the band is suppressed by the
   * UI rather than being quietly wrong.
   */
  isMinor: boolean;
  /** 65+. BMI reads low in older adults through muscle loss, not thinness. */
  isSenior: boolean;
};

export function calcBmi(input: {
  weightKg: number;
  heightCm: number;
  age?: number | null;
}): BmiResult | null {
  const { weightKg, heightCm } = input;
  // Bounds are sanity rails, not medical limits: they reject typos (a height
  // entered in metres into the cm field) rather than unusual bodies.
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  if (heightCm < 50 || heightCm > 260) return null;
  if (weightKg < 2 || weightKg > 500) return null;

  const m = heightCm / 100;
  const bmi = round(weightKg / (m * m), 1);
  const healthyMin = round(BMI_HEALTHY_MIN * m * m, 1);
  const healthyMax = round(BMI_HEALTHY_MAX * m * m, 1);
  const delta =
    weightKg < healthyMin
      ? round(weightKg - healthyMin, 1)
      : weightKg > healthyMax
        ? round(weightKg - healthyMax, 1)
        : 0;

  const age = input.age ?? null;
  return {
    bmi,
    asian: bandFor(bmi, BMI_ASIAN),
    international: bandFor(bmi, BMI_INTERNATIONAL),
    healthyMin,
    healthyMax,
    delta,
    isMinor: age !== null && age > 0 && age < 18,
    isSenior: age !== null && age >= 65,
  };
}

// Guidance per band. Written to the rules in registry.ts: no disease is named,
// nobody is told they are fine, and every band ends by pointing somewhere.
export const BMI_GUIDANCE: Record<BmiBandId, { head: Text; body: Text }> = {
  under: {
    head: { bn: "ওজন স্বাভাবিকের চেয়ে কম", en: "Below the healthy range" },
    body: {
      bn: "ওজন কম থাকলে রোগ প্রতিরোধ ক্ষমতা কমে, রক্তস্বল্পতা ও হাড় দুর্বল হওয়ার আশঙ্কা বাড়ে। খাবারের পরিমাণ না বাড়িয়ে বরং পুষ্টিগুণ বাড়ানো বেশি জরুরি। হঠাৎ ওজন কমে গিয়ে থাকলে সেটি আলাদা করে দেখা দরকার, একজন ডাক্তারের সাথে কথা বলুন।",
      en: "A low BMI can go with weaker immunity, anaemia and reduced bone strength. Raising the quality of what you eat matters more than raising the quantity. If the weight came off suddenly, that is worth looking into on its own, so talk to a doctor.",
    },
  },
  healthy: {
    head: { bn: "ওজন স্বাভাবিক সীমার মধ্যে", en: "Within the healthy range" },
    body: {
      bn: "আপনার উচ্চতার তুলনায় ওজন স্বাভাবিক সীমায় আছে। তবে বিএমআই একা পুরো ছবি দেয় না, পেটের চর্বি আলাদা ঝুঁকি তৈরি করে। বছরে অন্তত একবার সাধারণ স্বাস্থ্য পরীক্ষা করানো ভালো।",
      en: "Your weight sits in the healthy range for your height. BMI alone does not tell the whole story though, since fat around the waist carries its own risk. A general health check once a year is still worth doing.",
    },
  },
  raised: {
    head: { bn: "ওজন স্বাভাবিকের চেয়ে কিছুটা বেশি", en: "Above the healthy range" },
    body: {
      bn: "দক্ষিণ এশিয়ার মানুষের ক্ষেত্রে এই সীমা থেকেই ডায়াবেটিস ও উচ্চ রক্তচাপের ঝুঁকি বাড়তে শুরু করে, যদিও আন্তর্জাতিক চার্টে এটি এখনো স্বাভাবিক দেখাতে পারে। দিনে ৩০ মিনিট হাঁটা ও ভাত-চিনির পরিমাণ কমানো এই পর্যায়ে সবচেয়ে কার্যকর।",
      en: "For South Asians, risk of diabetes and high blood pressure starts rising from this range, even though an international chart may still call it normal. Thirty minutes of walking a day and cutting back on rice and sugar do the most at this stage.",
    },
  },
  high: {
    head: { bn: "ওজন বেশি, নজর দেওয়া দরকার", en: "High, worth acting on" },
    body: {
      bn: "এই পর্যায়ে ডায়াবেটিস, উচ্চ রক্তচাপ ও হৃদরোগের ঝুঁকি স্পষ্টভাবে বেশি থাকে। বর্তমান ওজনের ৫ থেকে ১০ শতাংশ কমাতে পারলেই ঝুঁকি অনেকটা কমে যায়। রক্তে শর্করা ও রক্তচাপ একবার পরীক্ষা করিয়ে নেওয়া এবং একজন পুষ্টিবিদ বা মেডিসিন বিশেষজ্ঞের পরামর্শ নেওয়া ভালো।",
      en: "Risk of diabetes, high blood pressure and heart disease is clearly raised in this range. Losing 5 to 10 percent of your current weight already brings a large part of it down. It is worth getting blood sugar and blood pressure checked, and seeing a nutritionist or a general physician.",
    },
  },
  "very-high": {
    head: { bn: "ওজন অনেক বেশি", en: "Very high" },
    body: {
      bn: "এই পর্যায়ে নিজে নিজে ডায়েট শুরু করার চেয়ে একজন ডাক্তারের তত্ত্বাবধানে পরিকল্পনা করা নিরাপদ। রক্তে শর্করা, রক্তচাপ ও কোলেস্টেরল পরীক্ষা করিয়ে নিন এবং দ্রুত একজন বিশেষজ্ঞের সাথে কথা বলুন।",
      en: "At this level a plan made with a doctor is safer than a diet started alone. Get blood sugar, blood pressure and cholesterol checked, and speak to a specialist soon.",
    },
  },
};

export const BMI_MINOR_NOTE: Text = {
  bn: "১৮ বছরের কম বয়সীদের ক্ষেত্রে প্রাপ্তবয়স্কদের এই সীমাগুলো প্রযোজ্য নয়। শিশু ও কিশোরদের ওজন বয়স ও লিঙ্গভেদে গ্রোথ চার্টের পার্সেন্টাইল দিয়ে বিচার করা হয়, তাই সংখ্যাটি দেখানো হলেও শ্রেণিবিভাগ দেওয়া হয়নি। শিশু বিশেষজ্ঞের সাথে কথা বলুন।",
  en: "These adult bands do not apply under 18. A child's or teenager's weight is judged against growth-chart percentiles that change with age and sex, so the number is shown but not classified. Please speak to a paediatrician.",
};

export const BMI_SENIOR_NOTE: Text = {
  bn: "৬৫ বছরের বেশি বয়সে পেশি কমে যাওয়ার কারণে বিএমআই প্রকৃত অবস্থার চেয়ে কম দেখাতে পারে। এই বয়সে সামান্য বেশি ওজন অনেক সময় ক্ষতিকর নয়, তাই সংখ্যাটির ব্যাখ্যা ডাক্তারের সাথে মিলিয়ে নিন।",
  en: "Over 65, muscle loss can make BMI read lower than the real picture. A slightly higher weight is often not harmful at this age, so check what the number means with a doctor.",
};

// ---------------------------------------------------------------------------
// BMR / TDEE / daily calories
// ---------------------------------------------------------------------------
// Mifflin-St Jeor (1990), which the Academy of Nutrition and Dietetics found
// more accurate for non-obese and obese adults than Harris-Benedict:
//
//   men:   BMR = 10w + 6.25h - 5a + 5
//   women: BMR = 10w + 6.25h - 5a - 161
//
// with w in kg, h in cm, a in years.
// ---------------------------------------------------------------------------

export type Sex = "male" | "female";

export type ActivityLevel = {
  id: string;
  factor: number;
  label: Text;
  hint: Text;
};

export const ACTIVITY_LEVELS: ActivityLevel[] = [
  {
    id: "sedentary",
    factor: 1.2,
    label: { bn: "প্রায় বসে থাকা", en: "Sedentary" },
    hint: { bn: "সারাদিন বসে কাজ, ব্যায়াম নেই", en: "Desk work, little or no exercise" },
  },
  {
    id: "light",
    factor: 1.375,
    label: { bn: "হালকা পরিশ্রম", en: "Lightly active" },
    hint: { bn: "সপ্তাহে ১ থেকে ৩ দিন হাঁটা বা হালকা ব্যায়াম", en: "Light exercise 1 to 3 days a week" },
  },
  {
    id: "moderate",
    factor: 1.55,
    label: { bn: "মাঝারি পরিশ্রম", en: "Moderately active" },
    hint: { bn: "সপ্তাহে ৩ থেকে ৫ দিন ব্যায়াম", en: "Exercise 3 to 5 days a week" },
  },
  {
    id: "active",
    factor: 1.725,
    label: { bn: "বেশি পরিশ্রম", en: "Very active" },
    hint: { bn: "সপ্তাহে ৬ থেকে ৭ দিন ব্যায়াম বা কায়িক শ্রমের কাজ", en: "Exercise 6 to 7 days a week, or manual work" },
  },
  {
    id: "athlete",
    factor: 1.9,
    label: { bn: "অত্যন্ত বেশি পরিশ্রম", en: "Extra active" },
    hint: { bn: "ভারী শারীরিক কাজ বা দিনে দুইবার অনুশীলন", en: "Heavy physical job or twice-daily training" },
  },
];

export type CalorieGoal = "lose" | "maintain" | "gain";

// 7 700 kcal is roughly one kilogram of body fat, so a 500 kcal daily deficit
// is about 0.5 kg a week — the rate WHO and NHS both describe as sustainable.
// Faster than that costs muscle and rebounds. The surplus is deliberately
// smaller than the deficit: gaining faster mostly adds fat.
const GOAL_DELTA: Record<CalorieGoal, number> = { lose: -500, maintain: 0, gain: 400 };

// Below these, a diet needs supervision to stay nutritionally complete. The
// tool clamps to them and says so rather than printing a number that would be
// unsafe to follow unattended.
const FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };

export type MacroSplit = { proteinG: number; carbsG: number; fatG: number };

export type CalorieResult = {
  bmr: number;
  tdee: number;
  /** Daily intake for the chosen goal, after the safety floor. */
  target: number;
  /** True when the goal's arithmetic fell below the floor and was raised to it. */
  clamped: boolean;
  goal: CalorieGoal;
  macros: MacroSplit;
  /** Every goal's target, for the comparison row. */
  all: Record<CalorieGoal, number>;
};

export function calcCalories(input: {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  activityFactor: number;
  goal: CalorieGoal;
}): CalorieResult | null {
  const { sex, age, weightKg, heightCm, activityFactor, goal } = input;
  if (!(age > 0) || age > 120) return null;
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  if (heightCm < 50 || heightCm > 260) return null;
  if (weightKg < 2 || weightKg > 500) return null;

  const bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161));
  const tdee = Math.round(bmr * activityFactor);

  const floor = FLOOR[sex];
  const applyGoal = (g: CalorieGoal) => Math.max(floor, Math.round(tdee + GOAL_DELTA[g]));
  const raw = Math.round(tdee + GOAL_DELTA[goal]);
  const target = applyGoal(goal);

  // IOM Acceptable Macronutrient Distribution Ranges for adults: protein
  // 10-35%, carbohydrate 45-65%, fat 20-35% of energy. 20/50/30 sits inside
  // all three. Protein and carbohydrate are 4 kcal/g, fat is 9 kcal/g.
  const macros: MacroSplit = {
    proteinG: Math.round((target * 0.2) / 4),
    carbsG: Math.round((target * 0.5) / 4),
    fatG: Math.round((target * 0.3) / 9),
  };

  return {
    bmr,
    tdee,
    target,
    clamped: raw < floor,
    goal,
    macros,
    all: { lose: applyGoal("lose"), maintain: applyGoal("maintain"), gain: applyGoal("gain") },
  };
}

export const CALORIE_GUIDANCE: Record<CalorieGoal, { head: Text; body: Text }> = {
  lose: {
    head: { bn: "ওজন কমানোর লক্ষ্য", en: "Losing weight" },
    body: {
      bn: "দিনে প্রায় ৫০০ ক্যালরি কম খেলে সপ্তাহে মোটামুটি আধা কেজি ওজন কমে, এটাই নিরাপদ গতি। এর চেয়ে দ্রুত কমাতে গেলে পেশি কমে যায় এবং ওজন আবার ফিরে আসার আশঙ্কা বাড়ে। প্রোটিন ঠিক রেখে ভাত ও চিনি কমানোই সবচেয়ে সহজ শুরু।",
      en: "Eating about 500 calories less a day takes off roughly half a kilo a week, which is the safe pace. Going faster costs muscle and the weight tends to come back. Keeping protein up while cutting rice and sugar is the easiest place to start.",
    },
  },
  maintain: {
    head: { bn: "ওজন ধরে রাখার লক্ষ্য", en: "Maintaining weight" },
    body: {
      bn: "এই পরিমাণ ক্যালরি আপনার বর্তমান ওজন ধরে রাখার জন্য যথেষ্ট। কাজের ধরন বা ব্যায়ামের পরিমাণ বদলালে হিসাবটিও বদলাবে, তাই মাঝে মাঝে আবার মিলিয়ে নিন।",
      en: "This is roughly what holds your current weight steady. The figure moves when your work or exercise changes, so it is worth recalculating now and then.",
    },
  },
  gain: {
    head: { bn: "ওজন বাড়ানোর লক্ষ্য", en: "Gaining weight" },
    body: {
      bn: "দিনে ৪০০ ক্যালরি বেশি খেলে ধীরে ধীরে ওজন বাড়ে, আর ধীরে বাড়লে চর্বির বদলে পেশি বাড়ার সুযোগ থাকে। এর সাথে সপ্তাহে অন্তত দুই দিন শক্তি বাড়ানোর ব্যায়াম যোগ করলে ফল ভালো হয়।",
      en: "An extra 400 calories a day builds weight gradually, and gradual gain is what leaves room for muscle rather than fat. Adding strength work at least twice a week makes a real difference.",
    },
  },
};

export const CALORIE_CLAMP_NOTE: Text = {
  bn: "আপনার লক্ষ্য অনুযায়ী হিসাব করা সংখ্যাটি নিরাপদ সর্বনিম্ন সীমার নিচে চলে যাচ্ছিল, তাই সেটি সর্বনিম্ন সীমায় রাখা হয়েছে। ডাক্তারের তত্ত্বাবধান ছাড়া এর চেয়ে কম ক্যালরিতে যাওয়া ঠিক নয়, কারণ তখন প্রয়োজনীয় ভিটামিন ও খনিজ পাওয়া কঠিন হয়ে পড়ে।",
  en: "The figure your goal worked out to fell below the safe minimum, so it has been raised to that minimum. Going lower without medical supervision is not advisable, because it becomes hard to get enough vitamins and minerals.",
};

// ---------------------------------------------------------------------------
// Pregnancy dating
// ---------------------------------------------------------------------------
// Naegele's rule: EDD = first day of the last menstrual period + 280 days,
// which assumes ovulation on day 14 of a 28-day cycle. ACOG's adjustment for
// a cycle of another length shifts the date by the difference, because a longer
// cycle means later ovulation and therefore later conception.
//
// ACOG is also clear that an ultrasound in the first trimester dates a
// pregnancy more accurately than LMP, and that is said on the page — a
// calculator that presents its own output as final would be overstating what
// this method can do.
// ---------------------------------------------------------------------------

export const GESTATION_DAYS = 280;
export const DEFAULT_CYCLE = 28;

const DAY_MS = 86_400_000;

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((atMidnight(b).getTime() - atMidnight(a).getTime()) / DAY_MS);
}

export type Trimester = 1 | 2 | 3;

export type DueDateResult = {
  edd: Date;
  /** Estimated conception date. An estimate from cycle length, not a fact. */
  conception: Date;
  /** Completed weeks and remaining days of gestation today. */
  weeks: number;
  days: number;
  /** Total days of gestation today; negative before the cycle-adjusted start. */
  totalDays: number;
  trimester: Trimester;
  daysRemaining: number;
  /** 0 to 1, for the progress bar. Clamped. */
  progress: number;
  /** Past 42 weeks — the arithmetic still works but no longer means anything. */
  overdue: boolean;
};

export type DueDateError = "future" | "too-old" | "invalid";

export function calcDueDate(input: {
  lmp: Date;
  cycleLength?: number;
  /** Injected so the result is deterministic and testable. */
  today?: Date;
}): { ok: true; value: DueDateResult } | { ok: false; error: DueDateError } {
  const lmp = input.lmp;
  if (!(lmp instanceof Date) || Number.isNaN(lmp.getTime())) return { ok: false, error: "invalid" };

  const today = atMidnight(input.today ?? new Date());
  const cycle = Math.min(45, Math.max(20, Math.round(input.cycleLength || DEFAULT_CYCLE)));
  const shift = cycle - DEFAULT_CYCLE;

  const elapsed = daysBetween(lmp, today);
  if (elapsed < 0) return { ok: false, error: "future" };
  // Beyond 44 weeks the input is almost certainly last year's date, and
  // printing a due date that has long passed helps nobody.
  if (elapsed > 308) return { ok: false, error: "too-old" };

  const edd = addDays(lmp, GESTATION_DAYS + shift);
  const conception = addDays(lmp, 14 + shift);

  // Gestational age is measured from the LMP, but the cycle adjustment moves
  // the effective start, so it is subtracted here too — otherwise the week
  // count and the due date would disagree with each other.
  const totalDays = Math.max(0, elapsed - shift);
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;

  const trimester: Trimester = weeks < 14 ? 1 : weeks < 28 ? 2 : 3;
  const daysRemaining = daysBetween(today, edd);

  return {
    ok: true,
    value: {
      edd,
      conception,
      weeks,
      days,
      totalDays,
      trimester,
      daysRemaining,
      progress: Math.min(1, Math.max(0, totalDays / GESTATION_DAYS)),
      overdue: weeks >= 42,
    },
  };
}

export const TRIMESTER_NOTE: Record<Trimester, { head: Text; body: Text }> = {
  1: {
    head: { bn: "প্রথম ত্রৈমাসিক", en: "First trimester" },
    body: {
      bn: "প্রথম তিন মাসেই শিশুর প্রধান অঙ্গগুলো তৈরি হয়, তাই এই সময়ে ফলিক অ্যাসিড খাওয়া ও প্রথম চেকআপ করানো সবচেয়ে জরুরি। ডাক্তারের পরামর্শ ছাড়া কোনো ওষুধ খাবেন না। এই সময়ের একটি আল্ট্রাসাউন্ড তারিখ নির্ধারণে সবচেয়ে নির্ভরযোগ্য।",
      en: "The baby's main organs form in these first three months, so folic acid and a first checkup matter most now. Do not take any medicine without a doctor's advice. An ultrasound in this period dates the pregnancy more reliably than any calculation.",
    },
  },
  2: {
    head: { bn: "দ্বিতীয় ত্রৈমাসিক", en: "Second trimester" },
    body: {
      bn: "সাধারণত এই সময়ে বমিভাব কমে আসে এবং শিশুর নড়াচড়া টের পাওয়া যায়। ১৮ থেকে ২২ সপ্তাহের মধ্যে বিস্তারিত আল্ট্রাসাউন্ড এবং রক্তস্বল্পতা ও ডায়াবেটিসের পরীক্ষা করানো হয়। রক্তচাপ নিয়মিত মাপা দরকার।",
      en: "Nausea usually eases now and movement becomes noticeable. A detailed ultrasound is usually done between 18 and 22 weeks, along with checks for anaemia and gestational diabetes. Blood pressure should be monitored regularly.",
    },
  },
  3: {
    head: { bn: "তৃতীয় ত্রৈমাসিক", en: "Third trimester" },
    body: {
      bn: "এই সময়ে চেকআপ ঘন ঘন হয় এবং প্রসবের প্রস্তুতি নেওয়ার সময়। কোথায় প্রসব করাবেন তা আগেই ঠিক করে রাখুন। তীব্র মাথাব্যথা, চোখে ঝাপসা দেখা, হাত-মুখ ফুলে যাওয়া, রক্তপাত বা শিশুর নড়াচড়া কমে গেলে দেরি না করে হাসপাতালে যান।",
      en: "Checkups become more frequent now and it is time to plan the birth. Decide in advance where you will deliver. Severe headache, blurred vision, swelling of the hands or face, bleeding, or reduced movement all mean going to hospital without delay.",
    },
  },
};

export const DUE_DATE_ACCURACY_NOTE: Text = {
  bn: "এই তারিখটি একটি সম্ভাব্য হিসাব, নির্দিষ্ট দিন নয়। প্রায় ২০ জনের মধ্যে ১ জনের সন্তান ঠিক এই তারিখে জন্মায়, বাকিরা এর আগে বা পরে জন্ম নেয়। হিসাবটি নির্ভর করছে মাসিকের তারিখ ও চক্রের দৈর্ঘ্য ঠিকমতো মনে থাকার ওপর। প্রথম তিন মাসের মধ্যে করা আল্ট্রাসাউন্ড এর চেয়ে বেশি নির্ভুল।",
  en: "This is an estimate, not a fixed day. About 1 baby in 20 arrives exactly on the estimated date and the rest come earlier or later. The figure also depends on remembering the period date and cycle length correctly. An ultrasound in the first three months is more accurate than any calculation.",
};

/**
 * WHO's 2016 antenatal care model recommends eight contacts through a
 * pregnancy, up from the older four-visit model that Bangladesh's national
 * programme still states as its minimum. Both are named on the page so the
 * schedule matches what a visitor will actually be offered locally.
 */
export const ANC_CONTACTS: { week: number; label: Text }[] = [
  { week: 12, label: { bn: "১ম চেকআপ", en: "1st contact" } },
  { week: 20, label: { bn: "২য় চেকআপ", en: "2nd contact" } },
  { week: 26, label: { bn: "৩য় চেকআপ", en: "3rd contact" } },
  { week: 30, label: { bn: "৪র্থ চেকআপ", en: "4th contact" } },
  { week: 34, label: { bn: "৫ম চেকআপ", en: "5th contact" } },
  { week: 36, label: { bn: "৬ষ্ঠ চেকআপ", en: "6th contact" } },
  { week: 38, label: { bn: "৭ম চেকআপ", en: "7th contact" } },
  { week: 40, label: { bn: "৮ম চেকআপ", en: "8th contact" } },
];
