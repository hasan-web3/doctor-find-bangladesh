import "server-only";
import { withPossessive } from "./bn";

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
  // Bilingual pattern (Bangla + English tokens in title & description) so
  // English queries like "Medicine specialist doctors" hit the Bangla page.
  const intro: ML = {
    bn: `${bn} সংক্রান্ত যেকোনো সমস্যায় অভিজ্ঞ ও যাচাইকৃত বিশেষজ্ঞ ডাক্তারদের তালিকা এখানে। প্রতিটি ডাক্তারের চেম্বারের ঠিকানা, সময়সূচি ও ভিজিট ফি দেখে সহজেই অ্যাপয়েন্টমেন্ট নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `Find experienced, verified ${en} specialists. Review each doctor's chamber address, schedule and visit fee, then book an appointment or call directly with ${BRAND_EN}.`,
  };
  const meta_title: ML = {
    bn: `${bn} বিশেষজ্ঞ ডাক্তারদের তালিকা | ${en} Specialist Doctors | ${BRAND_SHORT}`,
    en: `${en} Specialist Doctors | ${bn} বিশেষজ্ঞ ডাক্তারদের তালিকা | ${BRAND_SHORT}`,
  };
  const meta_description: ML = {
    bn: `${bn} সংক্রান্ত সমস্যায় অভিজ্ঞ Specialist Doctors খুঁজুন। Chamber Address, Schedule ও Visiting Fee জেনে সহজেই Doctor Appointment নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `Find experienced, verified ${en} specialists. Review each doctor's chamber address, schedule and visit fee, then book an appointment or call directly with ${BRAND_EN}.`,
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
  const bnPoss = withPossessive(bn); // খুলনা → খুলনার, বাগেরহাট → বাগেরহাটের
  // Bilingual meta pattern that matches the site's manually-tuned Khulna
  // entry: Bangla + English tokens mixed in both title and description so
  // the page ranks natively for English queries ("Best Doctors in Khulna",
  // "Doctor Appointment") coming from Bangladeshi users, while the primary
  // page language stays Bangla — no hreflang tricks, no cloaking risk.
  const intro: ML = {
    bn: `${bn} জেলার সকল বিশেষজ্ঞ ডাক্তারের তালিকা দেখুন। চেম্বারের ঠিকানা, সময়সূচী ও ফোন নম্বর দেখে সহজেই অ্যাপয়েন্টমেন্ট নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `Find top-rated doctors from all specialties in ${en} district. See chamber details, schedules, and book appointments easily with ${BRAND_EN}.`,
  };
  const meta_title: ML = {
    bn: `${bnPoss} সেরা ডাক্তারদের তালিকা | Best Doctors in ${en} | সকল বিভাগ`,
    en: `Best Doctors in ${en} | ${bnPoss} সেরা ডাক্তারদের তালিকা | All Specialties`,
  };
  // Description interpolates the district name so each district ships a
  // unique meta description (Google flags duplicates in Search Console).
  const meta_description: ML = {
    bn: `${bnPoss} সকল বিশেষজ্ঞ ডাক্তারের Chamber Address, Schedule ও Phone Number দেখে সহজেই Doctor Appointment নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `Find top-rated doctors from all specialties in ${en} district. See chamber details, schedules, and book appointments easily with ${BRAND_EN}.`,
  };
  return { intro, meta_title, meta_description };
}

// ---------------------------------------------------------------------------
// areas — "থানা / উপজেলা"
// ---------------------------------------------------------------------------
// Style locked to the exact phrasing used for the first seeded thanas
// (Khalishpur / Daulatpur / Sonadanga in the Khulna district). Bangla uses
// the possessive form of the thana name (খালিশপুর → খালিশপুরের) so the
// sentence reads naturally regardless of whether the base name ends in a
// vowel or consonant — see src/lib/bn.ts::withPossessive.

export function areaDefaults(name: ML, district?: ML | null): {
  intro: ML;
  meta_title: ML;
  meta_description: ML;
} {
  const { bn, en } = resolveNames(name);
  const dBn = (district?.bn || district?.en || "").trim();
  const dEn = (district?.en || district?.bn || "").trim();
  const bnPoss = withPossessive(bn); // e.g. খালিশপুর → খালিশপুরের
  // Bilingual pattern that mirrors districtDefaults: Bangla + English tokens
  // in both title and description so English queries ("Doctors in Khalishpur",
  // "Doctor Appointment") land on the Bangla page. Primary language stays
  // Bangla — no cloaking, no hreflang tricks.
  const intro: ML = {
    bn: `${bnPoss} এলাকার সকল বিশেষজ্ঞ ডাক্তারের তালিকা দেখুন। চেম্বারের ঠিকানা দেখে সহজেই অ্যাপয়েন্টমেন্ট নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `Find verified specialist doctors in ${en} area. See chamber details and book appointments easily with ${BRAND_EN}.`,
  };
  const meta_title: ML = {
    bn: dEn
      ? `${bnPoss} বিশেষজ্ঞ ডাক্তারদের তালিকা | Doctors in ${en} | ${dEn}`
      : `${bnPoss} বিশেষজ্ঞ ডাক্তারদের তালিকা | Doctors in ${en}`,
    en: dEn
      ? `Doctors List in ${en} | ${bnPoss} বিশেষজ্ঞ ডাক্তারদের তালিকা | ${dEn}`
      : `Doctors List in ${en} | ${bnPoss} বিশেষজ্ঞ ডাক্তারদের তালিকা`,
  };
  // Distinct per-area copy (avoids Search Console duplicate-meta warnings).
  const meta_description: ML = {
    bn: `${bn} এলাকার সেরা Specialist Doctors-এর তালিকা (Doctor List) দেখুন। Doctor Chamber Address, Phone Number ও সময়সূচী দেখে সহজেই Doctor Appointment নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `Find verified specialist doctors in ${en} area. See chamber details, Phone Number, and book appointments easily with ${BRAND_EN}.`,
  };
  return { intro, meta_title, meta_description };
}

// ---------------------------------------------------------------------------
// hospitals — "হাসপাতাল"
// ---------------------------------------------------------------------------
// Only meta_title / meta_description auto-fill. The `description` field is
// admin-authored rich HTML (about the hospital, its departments, history)
// and is intentionally left blank by default so nothing generic ships to
// the public page. Admin fills it manually or leaves it empty.

export function hospitalDefaults(
  name: ML,
  area?: ML | null,
  district?: ML | null,
): {
  meta_title: ML;
  meta_description: ML;
} {
  const { bn, en } = resolveNames(name);
  // Locality tail for the title — prefer district (city, higher search
  // volume: "hospitals in Khulna") over area/thana. Falls back to area
  // only when district is unknown so we still emit *some* locality.
  const locBn = (district?.bn || district?.en || area?.bn || area?.en || "").trim();
  const locEn = (district?.en || district?.bn || area?.en || area?.bn || "").trim();
  const meta_title: ML = {
    bn: locBn
      ? `${bn} - Doctor List & Services | ${locEn || locBn}`
      : `${bn} - Doctor List & Services`,
    en: locEn
      ? `${en} - Doctor List & Services | ${locEn}`
      : `${en} - Doctor List & Services`,
  };
  const meta_description: ML = {
    bn: `${bn}-এর বিশেষজ্ঞ ডাক্তারদের তালিকা, দেখার সময়সূচি, জরুরি সেবা এবং Chamber Address ও Phone Number দেখে সহজেই Doctor Appointment নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `Find Specialist Doctors (Doctor List), Doctor Visiting Schedule, Emergency Services, Chamber Address and Phone Number at ${en}. Book appointments easily with ${BRAND_EN}.`,
  };
  return { meta_title, meta_description };
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
  district?: ML | null;
  meta_title?: ML;
  meta_description?: ML;
}): { meta_title: ML; meta_description: ML } {
  const d = hospitalDefaults(input.name, input.area, input.district);
  return {
    meta_title: mergeML(input.meta_title, d.meta_title),
    meta_description: mergeML(input.meta_description, d.meta_description),
  };
}
