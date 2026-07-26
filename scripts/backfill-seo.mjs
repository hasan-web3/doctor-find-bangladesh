// One-shot backfill: for every specialty / district / area / hospital with
// empty intro / description / meta_title / meta_description, fill from the
// bilingual template in src/lib/seo-defaults.ts.
//
// Non-destructive: any field that already has non-whitespace content is
// left alone. Safe to re-run; idempotent.
//
// Usage: node scripts/backfill-seo.mjs
import "dotenv/config";
import pg from "pg";

const BRAND_BN = "ডক্টরস ফাইন্ড বাংলাদেশ";
const BRAND_EN = "Doctors Find Bangladesh";
const BRAND_SHORT = "DFBD";
const META_MAX = 155;

function clip(v) {
  if (!v || v.length <= META_MAX) return v;
  const cut = v.slice(0, META_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > META_MAX * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}
function pick(v, fallback) {
  return v && v.trim ? (v.trim() ? v : fallback) : v ?? fallback;
}
function names(nameJson) {
  const bn = (nameJson?.bn || nameJson?.en || "").trim();
  const en = (nameJson?.en || nameJson?.bn || "").trim();
  return { bn, en };
}

function specialtyDefaults(nameJson) {
  const { bn, en } = names(nameJson);
  const intro = {
    bn: `${bn} সংক্রান্ত যেকোনো সমস্যায় অভিজ্ঞ ও যাচাইকৃত বিশেষজ্ঞ ডাক্তারদের তালিকা এখানে। প্রতিটি ডাক্তারের চেম্বারের ঠিকানা, সময়সূচি ও ভিজিট ফি দেখে সহজেই অ্যাপয়েন্টমেন্ট নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `Find experienced, verified ${en} specialists. Review each doctor's chamber address, schedule and visit fee, then book an appointment or call directly with ${BRAND_EN}.`,
  };
  return {
    intro,
    meta_title: {
      bn: `${bn} বিশেষজ্ঞ ডাক্তারদের তালিকা | ${en} Specialist Doctors | ${BRAND_SHORT}`,
      en: `${en} Specialist Doctors | ${bn} বিশেষজ্ঞ ডাক্তারদের তালিকা | ${BRAND_SHORT}`,
    },
    meta_description: {
      bn: `${bn} সংক্রান্ত সমস্যায় অভিজ্ঞ Specialist Doctors খুঁজুন। Chamber Address, Schedule ও Visiting Fee জেনে সহজেই Doctor Appointment নিন ${BRAND_BN}-এর মাধ্যমে।`,
      en: `Find experienced, verified ${en} specialists. Review each doctor's chamber address, schedule and visit fee, then book an appointment or call directly with ${BRAND_EN}.`,
    },
  };
}

// Mirrors withPossessive() from src/lib/bn.ts — this script runs standalone
// under node so it re-implements the tiny helper instead of pulling the .ts.
function withPossessive(word) {
  if (!word) return "";
  const vowelEndings = ["া", "ি", "ী", "ু", "ূ", "ে", "ৈ", "ো", "ৌ"];
  return vowelEndings.includes(word.slice(-1)) ? `${word}র` : `${word}ের`;
}

function districtDefaults(nameJson) {
  const { bn, en } = names(nameJson);
  const bnPoss = withPossessive(bn);
  const intro = {
    bn: `${bn} জেলার সকল বিশেষজ্ঞ ডাক্তারের তালিকা দেখুন। চেম্বারের ঠিকানা, সময়সূচী ও ফোন নম্বর দেখে সহজেই অ্যাপয়েন্টমেন্ট নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `Find top-rated doctors from all specialties in ${en} district. See chamber details, schedules, and book appointments easily with ${BRAND_EN}.`,
  };
  return {
    intro,
    meta_title: {
      bn: `${bnPoss} সেরা ডাক্তারদের তালিকা | Best Doctors in ${en} | সকল বিভাগ`,
      en: `Best Doctors in ${en} | ${bnPoss} সেরা ডাক্তারদের তালিকা | All Specialties`,
    },
    meta_description: {
      bn: `${bnPoss} সকল বিশেষজ্ঞ ডাক্তারের Chamber Address, Schedule ও Phone Number দেখে সহজেই Doctor Appointment নিন ${BRAND_BN}-এর মাধ্যমে।`,
      en: `Find top-rated doctors from all specialties in ${en} district. See chamber details, schedules, and book appointments easily with ${BRAND_EN}.`,
    },
  };
}

function areaDefaults(nameJson, districtJson) {
  const { bn, en } = names(nameJson);
  const dEn = (districtJson?.en || districtJson?.bn || "").trim();
  const bnPoss = withPossessive(bn);
  const intro = {
    bn: `${bnPoss} এলাকার সকল বিশেষজ্ঞ ডাক্তারের তালিকা দেখুন। চেম্বারের ঠিকানা দেখে সহজেই অ্যাপয়েন্টমেন্ট নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `Find verified specialist doctors in ${en} area. See chamber details and book appointments easily with ${BRAND_EN}.`,
  };
  return {
    intro,
    meta_title: {
      bn: dEn
        ? `${bnPoss} বিশেষজ্ঞ ডাক্তারদের তালিকা | Doctors in ${en} | ${dEn}`
        : `${bnPoss} বিশেষজ্ঞ ডাক্তারদের তালিকা | Doctors in ${en}`,
      en: dEn
        ? `Doctors List in ${en} | ${bnPoss} বিশেষজ্ঞ ডাক্তারদের তালিকা | ${dEn}`
        : `Doctors List in ${en} | ${bnPoss} বিশেষজ্ঞ ডাক্তারদের তালিকা`,
    },
    meta_description: {
      bn: `${bn} এলাকার সেরা Specialist Doctors-এর তালিকা (Doctor List) দেখুন। Doctor Chamber Address, Phone Number ও সময়সূচী দেখে সহজেই Doctor Appointment নিন ${BRAND_BN}-এর মাধ্যমে।`,
      en: `Find verified specialist doctors in ${en} area. See chamber details, Phone Number, and book appointments easily with ${BRAND_EN}.`,
    },
  };
}

function hospitalDefaults(nameJson, areaJson, districtJson) {
  const { bn, en } = names(nameJson);
  const locBn = (districtJson?.bn || districtJson?.en || areaJson?.bn || areaJson?.en || "").trim();
  const locEn = (districtJson?.en || districtJson?.bn || areaJson?.en || areaJson?.bn || "").trim();
  // `description` (rich-text on-page prose) is kept short + factual so
  // nothing dishonest ships to the public page. Admin usually replaces this
  // manually; backfill only writes it when the field is empty.
  const description = {
    bn: `${bn} — ${locBn ? locBn + '-এ অবস্থিত ' : ''}একটি পরিচিত হাসপাতাল। এখানকার কর্মরত বিশেষজ্ঞ ডাক্তার, চেম্বারের সময়সূচি ও ভিজিট ফি দেখুন।`,
    en: `${en} — a well-known hospital${locEn ? ' in ' + locEn : ''}. Browse resident specialist doctors, chamber schedules and visit fees.`,
  };
  return {
    description,
    meta_title: {
      bn: locEn
        ? `${bn} - Doctor List & Services | ${locEn}`
        : `${bn} - Doctor List & Services`,
      en: locEn
        ? `${en} - Doctor List & Services | ${locEn}`
        : `${en} - Doctor List & Services`,
    },
    meta_description: {
      bn: `${bn}-এর বিশেষজ্ঞ ডাক্তারদের তালিকা, দেখার সময়সূচি, জরুরি সেবা এবং Chamber Address ও Phone Number দেখে সহজেই Doctor Appointment নিন ${BRAND_BN}-এর মাধ্যমে।`,
      en: `Find Specialist Doctors (Doctor List), Doctor Visiting Schedule, Emergency Services, Chamber Address and Phone Number at ${en}. Book appointments easily with ${BRAND_EN}.`,
    },
  };
}

// Merge existing JSONB { bn, en } with defaults — preserve any non-empty
// admin-typed value; only fill blank locales.
function mergeML(current, fallback) {
  const bn = (current?.bn ?? "").trim();
  const en = (current?.en ?? "").trim();
  return {
    bn: bn.length ? current.bn : fallback.bn,
    en: en.length ? current.en : fallback.en,
  };
}
function anyBlank(row, keys) {
  return keys.some((k) => {
    const v = row[k];
    if (!v) return true;
    const bn = (v.bn ?? "").trim();
    const en = (v.en ?? "").trim();
    return !bn.length || !en.length;
  });
}

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL missing"); process.exit(1); }
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
});
const client = await pool.connect();

async function backfillSpecialties() {
  const force = process.env.FORCE_SPECIALTIES === "1";
  const { rows } = await client.query(`
    SELECT id, name, intro, meta_title, meta_description FROM specialties
  `);
  let n = 0;
  for (const r of rows) {
    if (!force && !anyBlank(r, ["intro", "meta_title", "meta_description"])) continue;
    const d = specialtyDefaults(r.name);
    await client.query(
      `UPDATE specialties SET intro=$2, meta_title=$3, meta_description=$4, updated_at=now() WHERE id=$1`,
      [
        r.id,
        force ? d.intro : mergeML(r.intro, d.intro),
        force ? d.meta_title : mergeML(r.meta_title, d.meta_title),
        force ? d.meta_description : mergeML(r.meta_description, d.meta_description),
      ]
    );
    n++;
  }
  console.log(`specialties: ${n} row(s) ${force ? "OVERWRITTEN (FORCE_SPECIALTIES=1)" : "filled"}`);
}

async function backfillDistricts() {
  // FORCE_DISTRICTS=1 → overwrite intro / meta_title / meta_description on
  // EVERY district (even ones already filled) with the current template.
  // Use this when the template changes and you want existing districts to
  // adopt the new copy. Default (unset) keeps the non-destructive fill —
  // only blank locales get filled. Existing admin edits are preserved.
  const force = process.env.FORCE_DISTRICTS === "1";
  const { rows } = await client.query(`
    SELECT id, name, intro, meta_title, meta_description FROM districts
  `);
  let n = 0;
  for (const r of rows) {
    if (!force && !anyBlank(r, ["intro", "meta_title", "meta_description"])) continue;
    const d = districtDefaults(r.name);
    await client.query(
      `UPDATE districts SET intro=$2, meta_title=$3, meta_description=$4, updated_at=now() WHERE id=$1`,
      [
        r.id,
        force ? d.intro : mergeML(r.intro, d.intro),
        force ? d.meta_title : mergeML(r.meta_title, d.meta_title),
        force ? d.meta_description : mergeML(r.meta_description, d.meta_description),
      ]
    );
    n++;
  }
  console.log(`districts: ${n} row(s) ${force ? "OVERWRITTEN (FORCE_DISTRICTS=1)" : "filled"}`);
}

async function backfillAreas() {
  // FORCE_AREAS=1 → overwrite intro / meta_title / meta_description on every
  // area (even ones already filled) with the current template. Use after a
  // template change; default (unset) preserves admin edits.
  const force = process.env.FORCE_AREAS === "1";
  const { rows } = await client.query(`
    SELECT a.id, a.name, a.intro, a.meta_title, a.meta_description, d.name AS district_name
    FROM areas a LEFT JOIN districts d ON d.id = a.district_id
  `);
  let n = 0;
  for (const r of rows) {
    if (!force && !anyBlank(r, ["intro", "meta_title", "meta_description"])) continue;
    const d = areaDefaults(r.name, r.district_name);
    await client.query(
      `UPDATE areas SET intro=$2, meta_title=$3, meta_description=$4, updated_at=now() WHERE id=$1`,
      [
        r.id,
        force ? d.intro : mergeML(r.intro, d.intro),
        force ? d.meta_title : mergeML(r.meta_title, d.meta_title),
        force ? d.meta_description : mergeML(r.meta_description, d.meta_description),
      ]
    );
    n++;
  }
  console.log(`areas: ${n} row(s) ${force ? "OVERWRITTEN (FORCE_AREAS=1)" : "filled"}`);
}

async function backfillHospitals() {
  // FORCE_HOSPITALS=1 → overwrite meta_title + meta_description on every
  // hospital. `description` (the rich-text on-page prose) is ALWAYS left
  // alone in force mode — that field is admin-authored and blowing it away
  // would erase real content. Blank descriptions still get the boilerplate
  // fill regardless of the flag.
  const force = process.env.FORCE_HOSPITALS === "1";
  const { rows } = await client.query(`
    SELECT h.id, h.name, h.description, h.meta_title, h.meta_description,
           a.name AS area_name, d.name AS district_name
    FROM hospitals h
    LEFT JOIN areas a ON a.id = h.area_id
    LEFT JOIN districts d ON d.id = a.district_id
  `);
  let n = 0;
  for (const r of rows) {
    if (!force && !anyBlank(r, ["description", "meta_title", "meta_description"])) continue;
    const dflt = hospitalDefaults(r.name, r.area_name, r.district_name);
    await client.query(
      `UPDATE hospitals SET description=$2, meta_title=$3, meta_description=$4, updated_at=now() WHERE id=$1`,
      [
        r.id,
        mergeML(r.description, dflt.description), // never force description
        force ? dflt.meta_title : mergeML(r.meta_title, dflt.meta_title),
        force ? dflt.meta_description : mergeML(r.meta_description, dflt.meta_description),
      ]
    );
    n++;
  }
  console.log(`hospitals: ${n} row(s) ${force ? "OVERWRITTEN meta (FORCE_HOSPITALS=1)" : "filled"}`);
}

try {
  await backfillSpecialties();
  await backfillDistricts();
  await backfillAreas();
  await backfillHospitals();
} finally {
  client.release();
  await pool.end();
}
console.log("done.");
