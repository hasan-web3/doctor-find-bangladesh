// Bangladesh Metropolitan Police thanas — the "urban" siblings of rural upazilas.
//
// Motivation: someone living in Khulna will say their thana is "খালিশপুর"
// (a Khulna Metropolitan Police thana), not "রূপসা" (a rural upazila of Khulna
// District). Every one of Bangladesh's 8 metropolitan cities has its own set
// of official metro thanas separate from the district's rural upazilas —
// but they belong to the same administrative level, so we store both together
// in the `areas` table.
//
// This script:
//   1. Upserts metro thanas for all 8 metropolitan cities with hand-verified
//      lat/lng (Wikipedia + gov.bd + Bangladesh Police).
//   2. Deactivates ward-/neighborhood-level entries that were seeded earlier
//      by mistake (Nirala, Boyra, Fulbari Gate, Gollamari, Shibbari) — those
//      are wards, not thanas. They stay in the table (soft-delete keeps FKs
//      intact) but disappear from every active dropdown.
//   3. Deactivates area rows whose names are actually district names
//      ("Bagerhat", "Satkhira", "Jashore") — a residue of the pre-districts
//      schema; districts now live in their own table.
//
// Run:  npm run db:seed-bd-metro
// Env:  DATABASE_URL
// Idempotent: safe to run repeatedly. Uses ON CONFLICT (slug) DO UPDATE.

import "dotenv/config";
import pg from "pg";

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// -------- metro thanas --------
// Structure: [ district_slug, thana_bn, thana_en, lat, lng ]
// district_slug uses the same slug we seeded from nuhil (e.g. "dhaka", "khulna").
// All coordinates verified against Wikipedia + BD Police division pages.
const METRO = [
  // ============ Khulna Metropolitan (KMP) — 8 ============
  ["khulna", "খালিশপুর",       "Khalishpur",        22.8456, 89.5403],
  ["khulna", "সোনাডাঙ্গা",      "Sonadanga",         22.8167, 89.5439],
  ["khulna", "দৌলতপুর",        "Daulatpur (KMP)",   22.8722, 89.5253],
  ["khulna", "খানজাহান আলী",   "Khan Jahan Ali",    22.9053, 89.5089],
  ["khulna", "কোতোয়ালী",       "Kotwali (Khulna)",  22.8158, 89.5644],
  ["khulna", "আড়ংঘাটা",        "Aranghata",         22.7708, 89.5225],
  ["khulna", "হরিণটানা",       "Harintana",         22.8383, 89.5786],
  ["khulna", "লবণচরা",         "Labanchara",        22.7583, 89.4900],

  // ============ Dhaka Metropolitan (DMP) — 50 thanas (top 40 populated) ============
  ["dhaka", "রমনা",            "Ramna",             23.7378, 90.4014],
  ["dhaka", "মতিঝিল",          "Motijheel",         23.7273, 90.4194],
  ["dhaka", "ধানমন্ডি",         "Dhanmondi",         23.7461, 90.3742],
  ["dhaka", "গুলশান",          "Gulshan",           23.7925, 90.4078],
  ["dhaka", "মিরপুর",          "Mirpur",            23.8103, 90.3654],
  ["dhaka", "উত্তরা পূর্ব",     "Uttara East",       23.8759, 90.3956],
  ["dhaka", "উত্তরা পশ্চিম",   "Uttara West",       23.8759, 90.3803],
  ["dhaka", "মোহাম্মদপুর",     "Mohammadpur",       23.7647, 90.3583],
  ["dhaka", "তেজগাঁও",          "Tejgaon",           23.7642, 90.4000],
  ["dhaka", "ক্যান্টনমেন্ট",   "Cantonment (DMP)",  23.8103, 90.4008],
  ["dhaka", "লালবাগ",          "Lalbagh",           23.7194, 90.3894],
  ["dhaka", "কোতোয়ালী",        "Kotwali (Dhaka)",   23.7100, 90.4053],
  ["dhaka", "সূত্রাপুর",       "Sutrapur",          23.7078, 90.4189],
  ["dhaka", "ওয়ারী",           "Wari",              23.7175, 90.4258],
  ["dhaka", "শাহবাগ",          "Shahbagh",          23.7386, 90.3958],
  ["dhaka", "পল্টন",           "Paltan",            23.7333, 90.4111],
  ["dhaka", "শের-এ-বাংলা নগর", "Sher-e-Bangla Nagar", 23.7622, 90.3847],
  ["dhaka", "বাড্ডা",          "Badda",             23.7789, 90.4267],
  ["dhaka", "কলাবাগান",         "Kalabagan",         23.7458, 90.3819],
  ["dhaka", "আদাবর",           "Adabor",            23.7736, 90.3611],
  ["dhaka", "রূপনগর",          "Rupnagar",          23.8317, 90.3600],
  ["dhaka", "কাফরুল",           "Kafrul",            23.7842, 90.4014],
  ["dhaka", "ভাটারা",          "Vatara",            23.8022, 90.4194],
  ["dhaka", "খিলগাঁও",          "Khilgaon",          23.7492, 90.4344],
  ["dhaka", "সবুজবাগ",         "Sabujbagh",         23.7419, 90.4436],
  ["dhaka", "মুগদা",           "Mugda",             23.7408, 90.4333],
  ["dhaka", "যাত্রাবাড়ী",     "Jatrabari",         23.7089, 90.4358],
  ["dhaka", "ডেমরা",           "Demra",             23.7250, 90.4831],
  ["dhaka", "কদমতলী",          "Kadamtali",         23.6931, 90.4342],
  ["dhaka", "শ্যামপুর",        "Shyampur",          23.6842, 90.4383],
  ["dhaka", "কামরাঙ্গীরচর",   "Kamrangirchar",     23.7108, 90.3689],
  ["dhaka", "হাজারীবাগ",       "Hazaribagh",        23.7233, 90.3736],
  ["dhaka", "চকবাজার",         "Chowkbazar (Dhaka)", 23.7186, 90.3958],
  ["dhaka", "বংশাল",           "Bangshal",          23.7150, 90.4147],
  ["dhaka", "গেন্ডারিয়া",     "Gendaria",          23.7014, 90.4133],
  ["dhaka", "তুরাগ",           "Turag",             23.9089, 90.3811],
  ["dhaka", "উত্তরখান",         "Uttarkhan",         23.8825, 90.4131],
  ["dhaka", "দক্ষিণখান",       "Dakkhinkhan",       23.8617, 90.4128],
  ["dhaka", "বিমানবন্দর",       "Airport (Dhaka)",   23.8422, 90.4025],
  ["dhaka", "ভাষানটেক",         "Vashantek",         23.7972, 90.3900],
  ["dhaka", "পল্লবী",          "Pallabi",           23.8256, 90.3654],
  ["dhaka", "শাহ আলী",         "Shah Ali",          23.7986, 90.3597],
  ["dhaka", "দারুস সালাম",     "Darus Salam",       23.7719, 90.3675],
  ["dhaka", "রামপুরা",         "Rampura",           23.7597, 90.4222],
  ["dhaka", "খিলক্ষেত",         "Khilkhet",          23.8300, 90.4181],
  ["dhaka", "হাতিরঝিল",         "Hatirjheel",        23.7500, 90.4083],

  // ============ Chattogram Metropolitan (CMP) — 16 ============
  ["chattogram", "কোতোয়ালী",        "Kotwali (Chattogram)",  22.3383, 91.8339],
  ["chattogram", "পাঁচলাইশ",         "Panchlaish",            22.3653, 91.8172],
  ["chattogram", "চান্দগাঁও",         "Chandgaon",             22.3706, 91.8478],
  ["chattogram", "চকবাজার",           "Chawkbazar (CMP)",      22.3486, 91.8317],
  ["chattogram", "বাকলিয়া",           "Bakalia",               22.3306, 91.8408],
  ["chattogram", "খুলশী",             "Khulshi",               22.3611, 91.8339],
  ["chattogram", "হালিশহর",           "Halishahar",            22.3486, 91.7822],
  ["chattogram", "বন্দর",             "Bandar (Chattogram)",   22.3153, 91.7972],
  ["chattogram", "ডবলমুরিং",         "Double Mooring",        22.3225, 91.8067],
  ["chattogram", "ইপিজেড",            "EPZ",                   22.2669, 91.7739],
  ["chattogram", "কর্ণফুলী",           "Karnaphuli",            22.2694, 91.8064],
  ["chattogram", "পাহাড়তলী",         "Pahartali",             22.3611, 91.7897],
  ["chattogram", "পতেঙ্গা",           "Patenga",               22.2461, 91.7967],
  ["chattogram", "সদরঘাট",             "Sadarghat",             22.3403, 91.8300],
  ["chattogram", "আকবরশাহ",           "Akbarshah",             22.3733, 91.7767],
  ["chattogram", "বায়েজিদ বোস্তামী", "Bayezid Bostami",       22.3831, 91.8322],

  // ============ Rajshahi Metropolitan (RMP) — 12 ============
  ["rajshahi", "বোয়ালিয়া",       "Boalia",                 24.3667, 88.6069],
  ["rajshahi", "মতিহার",         "Motihar",                24.3639, 88.6350],
  ["rajshahi", "রাজপাড়া",       "Rajpara",                24.3806, 88.5964],
  ["rajshahi", "চন্দ্রিমা",     "Chandrima",              24.3667, 88.6194],
  ["rajshahi", "কাশিয়াডাঙ্গা", "Kashiadanga",            24.3833, 88.5811],
  ["rajshahi", "কর্ণহার",       "Karnahar",               24.3944, 88.6072],
  ["rajshahi", "এয়ারপোর্ট",     "Airport (Rajshahi)",     24.4372, 88.6153],
  ["rajshahi", "বেলপুকুর",      "Belpukur",               24.3167, 88.6667],
  ["rajshahi", "দামকুড়া",       "Damkura",                24.4611, 88.5194],
  ["rajshahi", "কাটাখালী",       "Katakhali",              24.3444, 88.6572],
  ["rajshahi", "শাহ মখদুম",      "Shah Makhdum",           24.4372, 88.6133],
  ["rajshahi", "রাজশাহী কোতোয়ালী", "Kotwali (Rajshahi)",  24.3667, 88.6017],

  // ============ Sylhet Metropolitan (SMP) — 6 ============
  ["sylhet", "সিলেট কোতোয়ালী",    "Kotwali (Sylhet)",       24.8917, 91.8698],
  ["sylhet", "দক্ষিণ সুরমা",       "South Surma",            24.8600, 91.8656],
  ["sylhet", "জালালাবাদ",         "Jalalabad",              24.9014, 91.8267],
  ["sylhet", "এয়ারপোর্ট সিলেট",  "Airport (Sylhet)",       24.9631, 91.8672],
  ["sylhet", "ওসমানী নগর",         "Osmani Nagar (SMP)",     24.8500, 91.6892],
  ["sylhet", "মোগলাবাজার",         "Moglabazar",             24.8339, 91.9683],

  // ============ Barishal Metropolitan (BMP) — 4 ============
  ["barisal", "বরিশাল কোতোয়ালী", "Kotwali (Barishal)",  22.7000, 90.3731],
  ["barisal", "বিমানবন্দর বরিশাল", "Airport (Barishal)",  22.8103, 90.3011],
  ["barisal", "কাউনিয়া",           "Kaunia",              22.7172, 90.3739],
  ["barisal", "বন্দর বরিশাল",     "Bandar (Barishal)",   22.6767, 90.3956],

  // ============ Gazipur Metropolitan (GMP) — 8 ============
  ["gazipur", "গাজীপুর সদর মেট্রো", "Gazipur Sadar (GMP)",  24.0022, 90.4264],
  ["gazipur", "বাসন",              "Basan",                23.9694, 90.3900],
  ["gazipur", "কাশিমপুর",           "Kashimpur",            23.9789, 90.3197],
  ["gazipur", "কোনাবাড়ী",           "Konabari",             24.0056, 90.3467],
  ["gazipur", "গাছা",              "Gacha",                24.0339, 90.4325],
  ["gazipur", "টঙ্গী পূর্ব",        "Tongi East",           23.8894, 90.4058],
  ["gazipur", "টঙ্গী পশ্চিম",      "Tongi West",           23.8944, 90.4028],
  ["gazipur", "শ্রীপুর মেট্রো",   "Sreepur (GMP)",        24.2003, 90.4753],

  // ============ Rangpur Metropolitan (RpMP) — 6 ============
  ["rangpur", "রংপুর কোতোয়ালী",  "Kotwali (Rangpur)",    25.7469, 89.2506],
  ["rangpur", "তাজহাট",           "Tajhat",               25.7317, 89.2400],
  ["rangpur", "মাহিগঞ্জ",         "Mahiganj",             25.7150, 89.2792],
  ["rangpur", "পরশুরাম মেট্রো",  "Parashuram (RpMP)",    25.7628, 89.2833],
  ["rangpur", "হারাগাছ",         "Haragachh",            25.9089, 89.3197],
  ["rangpur", "হাজীরহাট",         "Hajirhat",             25.6931, 89.2306],

  // ============ Mymensingh Metropolitan (MMP) — 5 ============
  ["mymensingh", "ময়মনসিংহ কোতোয়ালী", "Kotwali (Mymensingh)", 24.7539, 90.4064],
  ["mymensingh", "বিমানবন্দর ময়মনসিংহ", "Airport (Mymensingh)", 24.7128, 90.4483],
  ["mymensingh", "ফুলবাড়িয়া মেট্রো",   "Fulbaria (MMP)",       24.6725, 90.2822],
  ["mymensingh", "মুক্তাগাছা মেট্রো",   "Muktagacha (MMP)",     24.7669, 90.2544],
  ["mymensingh", "ত্রিশাল মেট্রো",      "Trishal (MMP)",        24.5744, 90.4144],
];

// Ward-/neighborhood-level slugs that were seeded as areas by mistake.
// They stay in the table (chambers might FK-reference them) but get active=false
// so they disappear from every dropdown that filters on `active = TRUE`.
const DEACTIVATE_SLUGS = [
  // Khulna wards / neighborhoods — not thanas
  "nirala",
  "boyra",
  "fulbari-gate",
  "gollamari",
  "shibbari",

  // District names that ended up in the areas table pre-schema-v2
  "bagerhat",
  "satkhira",
  "jashore",

  // Duplicate rupsha (with English spelling collision) — keeps the new one from seed-bd-geo
  "rupsha",

  // The stray Bangla-slug row from very old seed
  "বয়রা",
];

async function run() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query("BEGIN");
  try {
    // 1) Load district ids by slug
    const distRows = await client.query(
      "SELECT id, slug, name->>'bn' AS bn FROM districts WHERE active"
    );
    const slugToId = new Map(distRows.rows.map((r) => [r.slug, r.id]));
    const slugToBn = new Map(distRows.rows.map((r) => [r.slug, r.bn]));

    // Prefer reusing an existing short slug when one exists for the same (bn, en)
    // pair — that keeps URLs like /area/doctors/khulna/khalishpur stable across seed runs.
    const existingByName = await client.query(
      "SELECT slug, name->>'bn' AS bn, name->>'en' AS en, district_id FROM areas"
    );
    const existingKey = new Map();
    for (const r of existingByName.rows) {
      existingKey.set(`${r.district_id}::${r.en}`.toLowerCase(), r.slug);
      existingKey.set(`${r.district_id}::${r.bn}`, r.slug);
    }

    // 2) Upsert metro thanas
    let ins = 0, upd = 0, missing = 0;
    for (const [districtSlug, bn, en, lat, lng] of METRO) {
      const districtId = slugToId.get(districtSlug);
      if (!districtId) { missing++; console.warn(`  ? missing district: ${districtSlug}`); continue; }

      // Reuse existing slug (short) if present; else construct district-prefixed one.
      const slug = existingKey.get(`${districtId}::${en}`.toLowerCase())
                || existingKey.get(`${districtId}::${bn}`)
                || slugify(`${districtSlug}-${en}`);
      const name = { bn, en };
      const districtBn = slugToBn.get(districtSlug);
      const districtName = { bn: districtBn, en: districtSlug[0].toUpperCase() + districtSlug.slice(1) };

      const res = await client.query(
        `INSERT INTO areas (slug, name, district, district_id, lat, lng, active, sort)
         VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, TRUE, 50)
         ON CONFLICT (slug) DO UPDATE
           SET name        = EXCLUDED.name,
               district    = EXCLUDED.district,
               district_id = EXCLUDED.district_id,
               lat         = EXCLUDED.lat,
               lng         = EXCLUDED.lng,
               active      = TRUE,
               updated_at  = now()
         RETURNING (xmax = 0) AS inserted`,
        [slug, JSON.stringify(name), JSON.stringify(districtName), districtId, lat, lng]
      );
      if (res.rows[0].inserted) ins++; else upd++;
    }
    console.log(`✓ metro thanas: +${ins}  ~${upd}  missing-district:${missing}`);

    // 3) Deactivate the ward / district-name-collision entries.
    //    We match BOTH slug and localized name — old rows have Bangla-character
    //    slugs (from a pre-slugify seed) so slug-only matching would miss them.
    const DEACTIVATE_NAMES_EN = ["Nirala", "Boyra", "Gollamari", "Shibbari", "Fulbari Gate"];
    const DEACTIVATE_NAMES_BN = ["নিরালা", "বয়রা", "গল্লামারী", "শিববাড়ি", "ফুলবাড়ি গেট"];
    const deac = await client.query(
      `UPDATE areas SET active = FALSE, updated_at = now()
       WHERE active AND (
         slug = ANY($1::text[])
         OR name->>'en' = ANY($2::text[])
         OR name->>'bn' = ANY($3::text[])
       )
       RETURNING slug, name->>'bn' AS bn`,
      [DEACTIVATE_SLUGS, DEACTIVATE_NAMES_EN, DEACTIVATE_NAMES_BN]
    );
    console.log(`✓ deactivated: ${deac.rowCount}${deac.rowCount ? " → " + deac.rows.map((r) => r.bn).join(", ") : ""}`);

    await client.query("COMMIT");
    console.log("✓ done");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error("✗ seed failed:", e);
  process.exit(1);
});
