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
      bn: `${bn} বিশেষজ্ঞ ডাক্তারদের তালিকা | ${BRAND_SHORT}`,
      en: `Best ${en} Specialist Doctors | ${BRAND_SHORT}`,
    },
    meta_description: { bn: clip(intro.bn), en: clip(intro.en) },
  };
}

function districtDefaults(nameJson) {
  const { bn, en } = names(nameJson);
  const intro = {
    bn: `${bn} জেলার প্রতিটি এলাকার যাচাইকৃত বিশেষজ্ঞ ডাক্তার ও চেম্বার একসাথে খুঁজুন। বিভাগ ও লোকেশন অনুযায়ী ডাক্তার বাছাই করে সহজেই অ্যাপয়েন্টমেন্ট নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `Explore verified specialist doctors and chambers across every area of ${en} district. Filter by specialty or location and book easily with ${BRAND_EN}.`,
  };
  return {
    intro,
    meta_title: {
      bn: `${bn} জেলার সেরা ডাক্তার ও চেম্বার | ${BRAND_SHORT}`,
      en: `Best Doctors & Chambers in ${en} District | ${BRAND_SHORT}`,
    },
    meta_description: { bn: clip(intro.bn), en: clip(intro.en) },
  };
}

function areaDefaults(nameJson, districtJson) {
  const { bn, en } = names(nameJson);
  const dBn = (districtJson?.bn || districtJson?.en || "").trim();
  const dEn = (districtJson?.en || districtJson?.bn || "").trim();
  const suffixBn = dBn ? `, ${dBn} জেলা` : "";
  const suffixEn = dEn ? `, ${dEn} district` : "";
  const intro = {
    bn: `${bn}${suffixBn} এলাকার যাচাইকৃত ডাক্তার ও চেম্বার একসাথে দেখুন। চেম্বারের ঠিকানা, সময়সূচি ও ভিজিট ফি জানুন এবং সহজেই অ্যাপয়েন্টমেন্ট নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `See verified doctors and chambers in ${en}${suffixEn}. View chamber addresses, schedules and visit fees, then book an appointment easily with ${BRAND_EN}.`,
  };
  return {
    intro,
    meta_title: {
      bn: `${bn}${suffixBn} এলাকার ডাক্তার ও চেম্বার | ${BRAND_SHORT}`,
      en: `Doctors & Chambers in ${en}${suffixEn} | ${BRAND_SHORT}`,
    },
    meta_description: { bn: clip(intro.bn), en: clip(intro.en) },
  };
}

function hospitalDefaults(nameJson, areaJson) {
  const { bn, en } = names(nameJson);
  const aBn = (areaJson?.bn || areaJson?.en || "").trim();
  const aEn = (areaJson?.en || areaJson?.bn || "").trim();
  const suffixBn = aBn ? `${aBn}, ` : "";
  const suffixEn = aEn ? `${aEn}, ` : "";
  const description = {
    bn: `${bn} — ${suffixBn}বাংলাদেশের একটি পরিচিত হাসপাতাল। এখানকার কর্মরত বিশেষজ্ঞ ডাক্তার, চেম্বারের সময়সূচি ও ভিজিট ফি দেখে সহজেই অ্যাপয়েন্টমেন্ট নিন ${BRAND_BN}-এর মাধ্যমে।`,
    en: `${bn} is a well-known hospital in ${suffixEn}Bangladesh. Browse its resident specialist doctors, chamber schedules and visit fees, then book an appointment through ${BRAND_EN}.`,
  };
  return {
    description,
    meta_title: {
      bn: `${bn} — ডাক্তার ও চেম্বার তথ্য | ${BRAND_SHORT}`,
      en: `${en} — Doctors, Chambers & Appointments | ${BRAND_SHORT}`,
    },
    meta_description: { bn: clip(description.bn), en: clip(description.en) },
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
  const { rows } = await client.query(`
    SELECT id, name, intro, meta_title, meta_description FROM specialties
  `);
  let n = 0;
  for (const r of rows) {
    if (!anyBlank(r, ["intro", "meta_title", "meta_description"])) continue;
    const d = specialtyDefaults(r.name);
    const intro = mergeML(r.intro, d.intro);
    const meta_title = mergeML(r.meta_title, d.meta_title);
    const meta_description = mergeML(r.meta_description, d.meta_description);
    await client.query(
      `UPDATE specialties SET intro=$2, meta_title=$3, meta_description=$4, updated_at=now() WHERE id=$1`,
      [r.id, intro, meta_title, meta_description]
    );
    n++;
  }
  console.log(`specialties: ${n} row(s) filled`);
}

async function backfillDistricts() {
  const { rows } = await client.query(`
    SELECT id, name, intro, meta_title, meta_description FROM districts
  `);
  let n = 0;
  for (const r of rows) {
    if (!anyBlank(r, ["intro", "meta_title", "meta_description"])) continue;
    const d = districtDefaults(r.name);
    await client.query(
      `UPDATE districts SET intro=$2, meta_title=$3, meta_description=$4, updated_at=now() WHERE id=$1`,
      [
        r.id,
        mergeML(r.intro, d.intro),
        mergeML(r.meta_title, d.meta_title),
        mergeML(r.meta_description, d.meta_description),
      ]
    );
    n++;
  }
  console.log(`districts: ${n} row(s) filled`);
}

async function backfillAreas() {
  const { rows } = await client.query(`
    SELECT a.id, a.name, a.intro, a.meta_title, a.meta_description, d.name AS district_name
    FROM areas a LEFT JOIN districts d ON d.id = a.district_id
  `);
  let n = 0;
  for (const r of rows) {
    if (!anyBlank(r, ["intro", "meta_title", "meta_description"])) continue;
    const d = areaDefaults(r.name, r.district_name);
    await client.query(
      `UPDATE areas SET intro=$2, meta_title=$3, meta_description=$4, updated_at=now() WHERE id=$1`,
      [
        r.id,
        mergeML(r.intro, d.intro),
        mergeML(r.meta_title, d.meta_title),
        mergeML(r.meta_description, d.meta_description),
      ]
    );
    n++;
  }
  console.log(`areas: ${n} row(s) filled`);
}

async function backfillHospitals() {
  const { rows } = await client.query(`
    SELECT h.id, h.name, h.description, h.meta_title, h.meta_description, a.name AS area_name
    FROM hospitals h LEFT JOIN areas a ON a.id = h.area_id
  `);
  let n = 0;
  for (const r of rows) {
    if (!anyBlank(r, ["description", "meta_title", "meta_description"])) continue;
    const d = hospitalDefaults(r.name, r.area_name);
    await client.query(
      `UPDATE hospitals SET description=$2, meta_title=$3, meta_description=$4, updated_at=now() WHERE id=$1`,
      [
        r.id,
        mergeML(r.description, d.description),
        mergeML(r.meta_title, d.meta_title),
        mergeML(r.meta_description, d.meta_description),
      ]
    );
    n++;
  }
  console.log(`hospitals: ${n} row(s) filled`);
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
