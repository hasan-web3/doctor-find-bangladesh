import "server-only";

// Generate boilerplate intro / meta-title / meta-description for taxonomy
// entities (specialty, district, area, hospital) from just the bilingual
// name. Every admin surface — the standalone form, the modal inside the
// doctor form, hospital form, etc. — routes through the corresponding save
// action, and each save action asks this helper to fill any field that
// arrived empty. Admin-typed content is never overwritten.
//
// One helper per entity keeps the copy grammatically correct in both
// languages: specialty needs "সংক্রান্ত সমস্যায় বিশেষজ্ঞ", hospital needs
// "হাসপাতালে কর্মরত বিভাগসমূহ", etc. — they don't share phrasing.

const BRAND_BN = "ডক্টরস ফাইন্ড বাংলাদেশ";
const BRAND_EN = "Doctors Find Bangladesh";
const BRAND_SHORT = "DFBD";
// Google truncates meta descriptions around 155–160 chars. We aim for 155
// so the ellipsis / word-break falls on our terms, not the crawler's.
const META_MAX = 155;

export type ML = { bn: string; en: string };

// Pick the localised name that's present; when only one language exists
// fall through so intro copy still reads naturally in the other.
function resolveNames(name: ML): { bn: string; en: string } {
  const bn = (name.bn || name.en || "").trim();
  const en = (name.en || name.bn || "").trim();
  return { bn, en };
}

function clip(v: string, max = META_MAX): string {
  if (v.length <= max) return v;
  // Word-boundary trim — never cut mid-word (English) or mid-glyph-cluster.
  const cut = v.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

// Merge helper: preserve any admin-typed non-empty text, fill only blanks.
// Trims incoming values so a whitespace-only field is treated as empty.
function mergeML(current: ML | undefined, defaults: ML): ML {
  const bn = (current?.bn ?? "").trim();
  const en = (current?.en ?? "").trim();
  return {
    bn: bn.length > 0 ? current!.bn : defaults.bn,
    en: en.length > 0 ? current!.en : defaults.en,
  };
}

// ---------------------------------------------------------------------------
// specialties — "বিভাগ" / "specialty"
// ---------------------------------------------------------------------------

export function specialtyDefaults(name: ML): {
  intro: ML;
  meta_title: ML;
  meta_description: ML;
} {
  const { bn, en } = resolveNames(name);
  const intro: ML = {
    bn: `${bn} সংক্রান্ত যেকোনো সমস্যায় অভিজ্ঞ ও যাচাইকৃত বিশেষজ্ঞ ডাক্তারদের তালিকা এখানে। প্রতিটি ডাক্তারের চেম্বারের ঠিকানা, সময়সূচি ও ভিজিট ফি দেখে সহজেই অ্যাপয়েন্টমেন্ট নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `Find experienced, verified ${en} specialists. Review each doctor's chamber address, schedule and visit fee, then book an appointment or call directly with ${BRAND_EN}.`,
  };
  const meta_title: ML = {
    bn: `${bn} বিশেষজ্ঞ ডাক্তারদের তালিকা | ${BRAND_SHORT}`,
    en: `Best ${en} Specialist Doctors | ${BRAND_SHORT}`,
  };
  const meta_description: ML = {
    bn: clip(intro.bn),
    en: clip(intro.en),
  };
  return { intro, meta_title, meta_description };
}

// ---------------------------------------------------------------------------
// districts — "জেলা"
// ---------------------------------------------------------------------------

export function districtDefaults(name: ML): {
  intro: ML;
  meta_title: ML;
  meta_description: ML;
} {
  const { bn, en } = resolveNames(name);
  const intro: ML = {
    bn: `${bn} জেলার প্রতিটি এলাকার যাচাইকৃত বিশেষজ্ঞ ডাক্তার ও চেম্বার একসাথে খুঁজুন। বিভাগ ও লোকেশন অনুযায়ী ডাক্তার বাছাই করে সহজেই অ্যাপয়েন্টমেন্ট নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `Explore verified specialist doctors and chambers across every area of ${en} district. Filter by specialty or location and book easily with ${BRAND_EN}.`,
  };
  const meta_title: ML = {
    bn: `${bn} জেলার সেরা ডাক্তার ও চেম্বার | ${BRAND_SHORT}`,
    en: `Best Doctors & Chambers in ${en} District | ${BRAND_SHORT}`,
  };
  const meta_description: ML = { bn: clip(intro.bn), en: clip(intro.en) };
  return { intro, meta_title, meta_description };
}

// ---------------------------------------------------------------------------
// areas — "থানা / উপজেলা"
// ---------------------------------------------------------------------------

export function areaDefaults(name: ML, district?: ML | null): {
  intro: ML;
  meta_title: ML;
  meta_description: ML;
} {
  const { bn, en } = resolveNames(name);
  const dBn = (district?.bn || district?.en || "").trim();
  const dEn = (district?.en || district?.bn || "").trim();
  const suffixBn = dBn ? `, ${dBn} জেলা` : "";
  const suffixEn = dEn ? `, ${dEn} district` : "";
  const intro: ML = {
    bn: `${bn}${suffixBn} এলাকার যাচাইকৃত ডাক্তার ও চেম্বার একসাথে দেখুন। চেম্বারের ঠিকানা, সময়সূচি ও ভিজিট ফি জানুন এবং সহজেই অ্যাপয়েন্টমেন্ট নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `See verified doctors and chambers in ${en}${suffixEn}. View chamber addresses, schedules and visit fees, then book an appointment easily with ${BRAND_EN}.`,
  };
  const meta_title: ML = {
    bn: `${bn}${suffixBn} এলাকার ডাক্তার ও চেম্বার | ${BRAND_SHORT}`,
    en: `Doctors & Chambers in ${en}${suffixEn} | ${BRAND_SHORT}`,
  };
  const meta_description: ML = { bn: clip(intro.bn), en: clip(intro.en) };
  return { intro, meta_title, meta_description };
}

// ---------------------------------------------------------------------------
// hospitals — "হাসপাতাল"
// ---------------------------------------------------------------------------

export function hospitalDefaults(name: ML, area?: ML | null): {
  description: ML;
  meta_title: ML;
  meta_description: ML;
} {
  const { bn, en } = resolveNames(name);
  const aBn = (area?.bn || area?.en || "").trim();
  const aEn = (area?.en || area?.bn || "").trim();
  const suffixBn = aBn ? `${aBn}, ` : "";
  const suffixEn = aEn ? `${aEn}, ` : "";
  const description: ML = {
    bn: `${bn} — ${suffixBn}বাংলাদেশের একটি পরিচিত হাসপাতাল। এখানকার কর্মরত বিশেষজ্ঞ ডাক্তার, চেম্বারের সময়সূচি ও ভিজিট ফি দেখে সহজেই অ্যাপয়েন্টমেন্ট নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `${bn} is a well-known hospital in ${suffixEn}Bangladesh. Browse its resident specialist doctors, chamber schedules and visit fees, then book an appointment through ${BRAND_EN}.`,
  };
  const meta_title: ML = {
    bn: `${bn} — ডাক্তার ও চেম্বার তথ্য | ${BRAND_SHORT}`,
    en: `${en} — Doctors, Chambers & Appointments | ${BRAND_SHORT}`,
  };
  const meta_description: ML = { bn: clip(description.bn), en: clip(description.en) };
  return { description, meta_title, meta_description };
}

// ---------------------------------------------------------------------------
// Public entry points used by save actions.
// ---------------------------------------------------------------------------

export function fillSpecialtyBlanks(input: {
  name: ML;
  intro?: ML;
  meta_title?: ML;
  meta_description?: ML;
}): { intro: ML; meta_title: ML; meta_description: ML } {
  const d = specialtyDefaults(input.name);
  return {
    intro: mergeML(input.intro, d.intro),
    meta_title: mergeML(input.meta_title, d.meta_title),
    meta_description: mergeML(input.meta_description, d.meta_description),
  };
}

export function fillDistrictBlanks(input: {
  name: ML;
  intro?: ML;
  meta_title?: ML;
  meta_description?: ML;
}): { intro: ML; meta_title: ML; meta_description: ML } {
  const d = districtDefaults(input.name);
  return {
    intro: mergeML(input.intro, d.intro),
    meta_title: mergeML(input.meta_title, d.meta_title),
    meta_description: mergeML(input.meta_description, d.meta_description),
  };
}

export function fillAreaBlanks(input: {
  name: ML;
  district?: ML | null;
  intro?: ML;
  meta_title?: ML;
  meta_description?: ML;
}): { intro: ML; meta_title: ML; meta_description: ML } {
  const d = areaDefaults(input.name, input.district);
  return {
    intro: mergeML(input.intro, d.intro),
    meta_title: mergeML(input.meta_title, d.meta_title),
    meta_description: mergeML(input.meta_description, d.meta_description),
  };
}

export function fillHospitalBlanks(input: {
  name: ML;
  area?: ML | null;
  description?: ML;
  meta_title?: ML;
  meta_description?: ML;
}): { description: ML; meta_title: ML; meta_description: ML } {
  const d = hospitalDefaults(input.name, input.area);
  return {
    description: mergeML(input.description, d.description),
    meta_title: mergeML(input.meta_title, d.meta_title),
    meta_description: mergeML(input.meta_description, d.meta_description),
  };
}
