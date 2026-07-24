// One-shot project setup: run SQL migrations, seed initial bilingual Khulna data,
// and create the bootstrap admin account from .env values.
// Usage: npm run setup
// Flags: --migrate-only | --seed-only | --fresh (DROP everything and rebuild)
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
if (!DATABASE_URL) {
  console.error("✗ DATABASE_URL is missing. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1")
    ? false
    : { rejectUnauthorized: false },
});

async function dropAll(client) {
  console.log("→ dropping all existing tables/types (--fresh) ...");
  await client.query(`
    DO $$ DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
      FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  console.log("✓ database cleared");
}

async function migrate(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const done = new Set(
    (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name)
  );
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (done.has(file)) { console.log(`• skip ${file} (already applied)`); continue; }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`→ applying ${file} ...`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migrations(name) VALUES($1)", [file]);
      await client.query("COMMIT");
      console.log(`✓ ${file}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
}

// ---------------- bilingual seed data ----------------
const ml = (bn, en) => JSON.stringify({ bn, en });

const AREAS = [
  ["khalishpur", "খালিশপুর", "Khalishpur", 22.8456, 89.5403],
  ["daulatpur", "দৌলতপুর", "Daulatpur", 22.8722, 89.5253],
  ["sonadanga", "সোনাডাঙ্গা", "Sonadanga", 22.8167, 89.5439],
  ["khulna-sadar", "খুলনা সদর", "Khulna Sadar", 22.8158, 89.5644],
  ["boyra", "বয়রা", "Boyra", 22.8339, 89.5361],
  ["nirala", "নিরালা", "Nirala", 22.8047, 89.5514],
  ["gollamari", "গল্লামারী", "Gollamari", 22.7936, 89.5544],
  ["shibbari", "শিববাড়ি", "Shibbari", 22.8206, 89.5556],
  ["rupsha", "রূপসা", "Rupsha", 22.8017, 89.5750],
  ["fulbari-gate", "ফুলবাড়ি গেট", "Fulbari Gate", 22.8894, 89.5194],
  ["khanjahan-ali", "খানজাহান আলী", "Khan Jahan Ali", 22.9053, 89.5089],
  ["mongla", "মোংলা", "Mongla", 22.4867, 89.6031],
  ["bagerhat", "বাগেরহাট", "Bagerhat", 22.6516, 89.7859],
  ["jashore", "যশোর", "Jashore", 23.1667, 89.2167],
  ["satkhira", "সাতক্ষীরা", "Satkhira", 22.7185, 89.0705],
];

const SPECIALTIES = [
  ["medicine", "মেডিসিন", "Medicine", "activity", 0],
  ["cardiology", "হৃদরোগ (কার্ডিওলজি)", "Cardiology", "heart", 1],
  ["neurology", "স্নায়ুরোগ (নিউরোলজি)", "Neurology", "brain", 2],
  ["pediatrics", "শিশু বিশেষজ্ঞ", "Pediatrics", "baby", 3],
  ["gynecology", "গাইনি ও প্রসূতি", "Gynecology & Obstetrics", "female", 4],
  ["dermatology", "চর্ম ও যৌন", "Dermatology", "droplet", 0],
  ["orthopedics", "হাড় জোড়া (অর্থোপেডিক)", "Orthopedics", "bone", 1],
  ["ophthalmology", "চোখ", "Ophthalmology", "eye", 2],
  ["ent", "নাক কান গলা", "ENT", "ear", 3],
  ["dental", "দন্ত (ডেন্টাল)", "Dental", "tooth", 4],
  ["nephrology", "কিডনি", "Nephrology", "droplet", 0],
  ["gastroenterology", "গ্যাস্ট্রো ও লিভার", "Gastroenterology", "activity", 1],
  ["endocrinology", "ডায়াবেটিস ও হরমোন", "Diabetes & Endocrinology", "droplet", 2],
  ["psychiatry", "মানসিক স্বাস্থ্য", "Psychiatry", "brain", 3],
  ["urology", "ইউরোলজি", "Urology", "droplet", 4],
  ["oncology", "ক্যান্সার", "Oncology", "shield", 0],
  ["physiotherapy", "ফিজিওথেরাপি", "Physiotherapy", "run", 1],
  ["general-laparoscopic-surgery", "জেনারেল ও ল্যাপারোস্কোপিক সার্জারি", "General & Laparoscopic Surgery", "Scissors", 2],
  ["pulmonology-respiratory-medicine", "বক্ষব্যাধি ও অ্যাজমা", "Pulmonology & Respiratory Medicine", "Lungs", 3],
  ["rheumatology", "বাতব্যথা ও রিউমাটোলজি", "Rheumatology", "Bone", 4],
  ["physical-medicine-rehabilitation", "ফিজিকেল মেডিসিন ও রিহেবিলিটেশন", "Physical Medicine & Rehabilitation", "PersonStanding", 0],
  ["neonatology", "নবজাতক রোগ (নিওনেটোলোজি)", "Neonatology", "Baby", 1],
  ["neurosurgery", "নিউরোসার্জারি", "Neurosurgery", "BrainCircuit", 2],
  ["cardiac-surgery", "কার্ডিয়াক সার্জারি (হৃদরোগ সার্জারি)", "Cardiac Surgery", "HeartPulse", 3],
  ["pediatric-surgery", "শিশু সার্জারি", "Pediatric Surgery", "Scissors", 4],
  ["vascular-surgery", "ভাস্কুলার সার্জারি", "Vascular Surgery", "Activity", 0],
  ["plastic-cosmetic-surgery", "প্লাস্টিক ও কসমোটিক সার্জারি", "Plastic & Cosmetic Surgery", "Award", 1],
  ["hematology", "রক্তরোগ (হেমাটোলজি)", "Hematology", "Droplets", 2],
  ["pain-medicine-anesthesia", "পেইন মেডিসিন ও অ্যানেস্থেসিয়া", "Pain Medicine & Anesthesia", "Siren", 3],
  ["nutrition-dietetics", "পুষ্টি ও ডায়েট", "Nutrition & Dietetics", "Carrot", 4],
  ["critical-care-icu", "ক্রিটিক্যাল কেয়ার (আইসিইউ)", "Critical Care & ICU", "Bed", 0],
  ["radiology-imaging", "রেডিওলজি ও ইমেজিং", "Radiology & Imaging", "Scan", 1],
  ["hepatology", "হেপাটোলজি (লিভার বিশেষজ্ঞ)", "Hepatology", "Activity", 2],
  ["infectious-diseases", "সংক্রামক ব্যাধি", "Infectious Diseases", "Bug", 3],
];

const HOSPITALS = [
  ["khulna-medical-college", "খুলনা মেডিকেল কলেজ হাসপাতাল", "Khulna Medical College Hospital", "khulna-sadar",
    [["মেডিসিন", "Medicine"], ["সার্জারি", "Surgery"], ["কার্ডিওলজি", "Cardiology"], ["নিউরোলজি", "Neurology"], ["শিশু", "Pediatrics"], ["গাইনি", "Gynecology"]]],
  ["gazi-medical-college", "গাজী মেডিকেল কলেজ হাসপাতাল", "Gazi Medical College Hospital", "sonadanga",
    [["মেডিসিন", "Medicine"], ["কার্ডিওলজি", "Cardiology"], ["অর্থোপেডিক", "Orthopedics"], ["গাইনি", "Gynecology"]]],
  ["ad-din-akij-medical", "আদ দ্বীন আকিজ মেডিকেল কলেজ হাসপাতাল", "Ad-din Akij Medical College Hospital", "khalishpur",
    [["মেডিসিন", "Medicine"], ["শিশু", "Pediatrics"], ["গাইনি", "Gynecology"], ["সার্জারি", "Surgery"], ["চোখ", "Ophthalmology"]]],
  ["city-medical-college", "সিটি মেডিকেল কলেজ হাসপাতাল", "City Medical College Hospital", "daulatpur",
    [["মেডিসিন", "Medicine"], ["অর্থোপেডিক", "Orthopedics"], ["চর্ম", "Dermatology"], ["ইএনটি", "ENT"]]],
  ["khulna-shishu-hospital", "খুলনা শিশু হাসপাতাল", "Khulna Shishu Hospital", "boyra",
    [["শিশু", "Pediatrics"], ["নবজাতক", "Neonatology"], ["টিকাদান", "Vaccination"]]],
  ["fatima-hospital", "ফাতিমা হাসপাতাল", "Fatima Hospital", "sonadanga",
    [["মেডিসিন", "Medicine"], ["গাইনি", "Gynecology"], ["সার্জারি", "Surgery"]]],
];

const HOME_FAQS = [
  ["ডক্টরবন্ধু কীভাবে কাজ করে?", "How does DoctorBondhu work?",
    "আপনি এলাকা বা বিশেষজ্ঞ বিভাগ অনুযায়ী ডাক্তার খুঁজবেন, প্রোফাইল ও চেম্বারের তথ্য দেখবেন, তারপর সরাসরি কল করবেন বা অনলাইনে অ্যাপয়েন্টমেন্ট নেবেন।",
    "Search doctors by area or specialty, review their profile and chamber details, then call directly or book an appointment online."],
  ["অ্যাপয়েন্টমেন্ট নিতে কি টাকা লাগে?", "Does booking an appointment cost anything?",
    "ডক্টরবন্ধুতে ডাক্তার খোঁজা ও অ্যাপয়েন্টমেন্ট নেওয়া রোগীদের জন্য সম্পূর্ণ বিনামূল্যে। শুধু ডাক্তারের নির্ধারিত ভিজিট ফি চেম্বারে দিতে হবে।",
    "Finding doctors and booking appointments on DoctorBondhu is completely free for patients. You only pay the doctor's visit fee at the chamber."],
  ["আমি কি এলাকা অনুযায়ী ডাক্তার খুঁজতে পারব?", "Can I search doctors by area?",
    "হ্যাঁ, খুলনার প্রতিটি এলাকা অনুযায়ী আলাদা করে ডাক্তার ও চেম্বার খুঁজে নিতে পারবেন।",
    "Yes, you can browse doctors and chambers for every area of Khulna separately."],
  ["ডাক্তার হিসেবে প্রোফাইল যুক্ত করব কীভাবে?", "How do I list my profile as a doctor?",
    "ডাক্তারদের জন্য পেজে গিয়ে যোগাযোগ করুন অথবা সরাসরি আমাদের হেল্পলাইন নম্বরে কল করুন।",
    "Visit the For Doctors page and submit your details, or call our helpline directly."],
  ["জরুরি প্রয়োজনে কীভাবে যোগাযোগ করব?", "How do I reach you in an emergency?",
    "যেকোনো জরুরি সহায়তার জন্য আমাদের হেল্পলাইন নম্বরে কল করুন বা হোয়াটসঅ্যাপে মেসেজ দিন।",
    "Call our helpline or message us on WhatsApp for any urgent help."],
  ["ডাক্তারের তথ্য কি নির্ভরযোগ্য?", "Is the doctor information reliable?",
    "আমরা প্রতিটি ডাক্তারের ডিগ্রি ও চেম্বারের তথ্য যাচাই করে ভেরিফায়েড ব্যাজ দিই, তাই তথ্য নির্ভরযোগ্য।",
    "We verify every doctor's credentials and chamber details before issuing a verified badge, so the information is trustworthy."],
];

const TESTIMONIALS = [
  ["রুবিনা পারভীন", "খালিশপুর, খুলনা", "Khalishpur, Khulna",
    "ডক্টরবন্ধু থেকে খুব সহজে আমার এলাকার একজন ভালো শিশু ডাক্তার পেয়েছি। ফোনেই অ্যাপয়েন্টমেন্ট হয়ে গেছে।",
    "I easily found a great pediatrician in my area through DoctorBondhu. The appointment was done over the phone."],
  ["মোঃ সেলিম রেজা", "সোনাডাঙ্গা, খুলনা", "Sonadanga, Khulna",
    "ডাক্তারের চেম্বারের সময় আর ফি আগেই জানতে পারলাম, তাই আর ঘুরতে হয়নি। সেবা সত্যিই প্রশংসনীয়।",
    "I knew the chamber hours and fee in advance, so no wasted trips. Truly commendable service."],
  ["নাফিসা তাবাসসুম", "বয়রা, খুলনা", "Boyra, Khulna",
    "বয়স্ক বাবাকে নিয়ে চিন্তায় ছিলাম, হেল্পলাইনে কল করতেই ভালো একজন হৃদরোগ বিশেষজ্ঞের সন্ধান পেলাম।",
    "I was worried about my elderly father; one call to the helpline found us an excellent cardiologist."],
];

const HERO_SLIDES = [
  ["যাচাইকৃত ডাক্তার", "Verified Doctors", "সব ডাক্তারের তথ্য যাচাই করা, নিশ্চিন্তে বেছে নিন।", "Every doctor's credentials are verified. Choose with confidence.", "shield"],
  ["সহজ অ্যাপয়েন্টমেন্ট", "Easy Appointments", "মাত্র কয়েক ক্লিকেই পছন্দের ডাক্তারের সময় নিন।", "Book your preferred doctor's slot in just a few clicks.", "calendar"],
  ["আপনার এলাকায়", "In Your Area", "খুলনার কাছের এলাকার ডাক্তার ও চেম্বার খুঁজুন।", "Find doctors and chambers near you across Khulna.", "pin"],
];

const DEFAULT_SETTINGS = {
  brand_name: { bn: "ডক্টরস ফাইন্ড বাংলাদেশ", en: "Doctors Find Bangladesh" },
  helpline: "01774739914",
  helpline_bn: "০১৭৭৪৭৩৯৯১৪",
  whatsapp: "8801774739914",
  email: "info@doctorsfindbangladesh.com",
  address: { bn: "সোনাডাঙ্গা, খুলনা, বাংলাদেশ", en: "Sonadanga, Khulna, Bangladesh" },
  facebook: "",
  youtube: "",
  instagram: "",
  logo_url: "",
  seo_title_template: { bn: "%s | DFBD", en: "%s | DFBD" },
  seo_default_title: { bn: "খুলনার সেরা ডাক্তার খুঁজুন | ডক্টরস ফাইন্ড বাংলাদেশ", en: "Find the Best Doctors in Khulna | Doctors Find Bangladesh" },
  seo_default_description: {
    bn: "খুলনার যাচাইকৃত বিশেষজ্ঞ ডাক্তার এলাকা ও বিভাগ অনুযায়ী খুঁজুন এবং সহজে অ্যাপয়েন্টমেন্ট নিন। চেম্বারের ঠিকানা, সময়সূচি ও ভিজিট ফি এক জায়গায়।",
    en: "Find verified specialist doctors in Khulna by area and specialty, and book appointments easily. Chamber addresses, schedules and visit fees in one place.",
  },
  seo_default_og_image: "",
  plans: [
    { key: "basic", name: { bn: "বেসিক", en: "Basic" }, price: 500, period: { bn: "/ মাস", en: "/ month" }, popular: false,
      feats: [
        { bn: "ডিরেক্টরিতে প্রোফাইল লিস্টিং", en: "Profile listing in the directory" },
        { bn: "এলাকা ও বিভাগ অনুযায়ী দেখানো", en: "Shown by area and specialty" },
        { bn: "চেম্বার ও সময়সূচি", en: "Chamber and schedule" },
        { bn: "রোগীর কল সরাসরি আপনার নম্বরে", en: "Patient calls go directly to you" },
      ] },
    { key: "featured", name: { bn: "ফিচার্ড", en: "Featured" }, price: 1500, period: { bn: "/ মাস", en: "/ month" }, popular: true,
      feats: [
        { bn: "বেসিকের সব সুবিধা", en: "Everything in Basic" },
        { bn: "ভেরিফায়েড ও ফিচার্ড ব্যাজ", en: "Verified & Featured badges" },
        { bn: "সার্চে উপরের দিকে অবস্থান", en: "Higher placement in search" },
        { bn: "হোমপেজে ফিচার্ড সেকশনে প্রদর্শন", en: "Shown in the homepage featured section" },
        { bn: "অনলাইন অ্যাপয়েন্টমেন্ট বুকিং", en: "Online appointment booking" },
      ] },
    { key: "premium", name: { bn: "প্রিমিয়াম", en: "Premium" }, price: 3000, period: { bn: "/ মাস", en: "/ month" }, popular: false,
      feats: [
        { bn: "ফিচার্ডের সব সুবিধা", en: "Everything in Featured" },
        { bn: "বিভাগ ও এলাকা পেজে শীর্ষে", en: "Top of specialty & area pages" },
        { bn: "ব্লগে বিশেষজ্ঞ কলাম", en: "Expert column on the blog" },
        { bn: "রোগীর রিভিউ ম্যানেজমেন্ট", en: "Patient review management" },
        { bn: "ডেডিকেটেড সাপোর্ট", en: "Dedicated support" },
      ] },
  ],
  stats: [
    { value: 500, suffix: "+", label: { bn: "যাচাইকৃত ডাক্তার", en: "Verified Doctors" } },
    { value: 20, suffix: "+", label: { bn: "বিশেষজ্ঞ বিভাগ", en: "Specialties" } },
    { value: 15, suffix: "+", label: { bn: "এলাকা", en: "Areas" } },
    { value: 10000, suffix: "+", label: { bn: "সন্তুষ্ট রোগী", en: "Happy Patients" } },
  ],
};

async function seed(client) {
  console.log("→ seeding areas, specialties, hospitals, settings ...");

  for (let i = 0; i < AREAS.length; i++) {
    const [slug, bn, en, lat, lng] = AREAS[i];
    await client.query(
      `INSERT INTO areas (slug, name, lat, lng, sort, intro)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (slug) DO NOTHING`,
      [slug, ml(bn, en), lat, lng, i,
        ml(
          `খুলনার ${bn} এলাকায় বিভিন্ন বিশেষজ্ঞ বিভাগের অভিজ্ঞ ডাক্তারের তালিকা, চেম্বারের ঠিকানা ও সময়সূচি এক জায়গায়। আপনার কাছের ডাক্তার বেছে নিয়ে সহজে অ্যাপয়েন্টমেন্ট নিন।`,
          `A complete list of experienced doctors across specialties in ${en}, Khulna, with chamber addresses and schedules in one place. Pick a doctor near you and book easily.`
        )]
    );
  }

  for (let i = 0; i < SPECIALTIES.length; i++) {
    const [slug, bn, en, icon, tint] = SPECIALTIES[i];
    await client.query(
      `INSERT INTO specialties (slug, name, icon, tint, sort, intro)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (slug) DO NOTHING`,
      [slug, ml(bn, en), icon, tint, i,
        ml(
          `${bn} সংক্রান্ত যেকোনো সমস্যায় খুলনার অভিজ্ঞ ও যাচাইকৃত বিশেষজ্ঞ ডাক্তারদের তালিকা এখানে। প্রতিটি ডাক্তারের চেম্বারের ঠিকানা, সময়সূচি ও ভিজিট ফি দেখে সহজেই অ্যাপয়েন্টমেন্ট নিন অথবা সরাসরি কল করুন।`,
          `Find experienced, verified ${en} specialists in Khulna. Review each doctor's chamber address, schedule and visit fee, then book an appointment or call directly.`
        )]
    );
  }

  for (let i = 0; i < HOSPITALS.length; i++) {
    const [slug, bn, en, areaSlug, departments] = HOSPITALS[i];
    await client.query(
      `INSERT INTO hospitals (slug, name, area_id, departments, sort)
       VALUES ($1,$2,(SELECT id FROM areas WHERE slug=$3),$4,$5)
       ON CONFLICT (slug) DO NOTHING`,
      [slug, ml(bn, en), areaSlug, JSON.stringify(departments.map(([b, e]) => ({ bn: b, en: e }))), i]
    );
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await client.query(
      `INSERT INTO site_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(value)]
    );
  }

  const faqCount = (await client.query("SELECT count(*)::int AS c FROM faqs")).rows[0].c;
  if (faqCount === 0) {
    for (let i = 0; i < HOME_FAQS.length; i++) {
      const [qbn, qen, abn, aen] = HOME_FAQS[i];
      await client.query(
        `INSERT INTO faqs (scope, question, answer, sort) VALUES ('home',$1,$2,$3)`,
        [ml(qbn, qen), ml(abn, aen), i]
      );
    }
  }

  const testiCount = (await client.query("SELECT count(*)::int AS c FROM testimonials")).rows[0].c;
  if (testiCount === 0) {
    for (let i = 0; i < TESTIMONIALS.length; i++) {
      const [name, areaBn, areaEn, qBn, qEn] = TESTIMONIALS[i];
      await client.query(
        `INSERT INTO testimonials (name, area_text, quote, sort) VALUES ($1,$2,$3,$4)`,
        [name, ml(areaBn, areaEn), ml(qBn, qEn), i]
      );
    }
  }

  const slideCount = (await client.query("SELECT count(*)::int AS c FROM hero_slides")).rows[0].c;
  if (slideCount === 0) {
    for (let i = 0; i < HERO_SLIDES.length; i++) {
      const [tBn, tEn, xBn, xEn, icon] = HERO_SLIDES[i];
      await client.query(
        `INSERT INTO hero_slides (title, text, icon, sort) VALUES ($1,$2,$3,$4)`,
        [ml(tBn, tEn), ml(xBn, xEn), icon, i]
      );
    }
  }

  const blogCatCount = (await client.query("SELECT count(*)::int AS c FROM blog_categories")).rows[0].c;
  if (blogCatCount === 0) {
    const cats = [
      ["child-health", "শিশু স্বাস্থ্য", "Child Health"],
      ["heart-health", "হৃদরোগ", "Heart Health"],
      ["lifestyle", "সুস্থ জীবনযাপন", "Healthy Lifestyle"],
      ["womens-health", "নারী স্বাস্থ্য", "Women's Health"],
    ];
    for (let i = 0; i < cats.length; i++) {
      await client.query(`INSERT INTO blog_categories (slug, name, sort) VALUES ($1,$2,$3)`, [cats[i][0], ml(cats[i][1], cats[i][2]), i]);
    }
  }

  const integrationKeys = ["smtp", "sms", "google_maps", "ip_geo", "analytics", "recaptcha"];
  for (const key of integrationKeys) {
    await client.query(`INSERT INTO integrations (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`, [key]);
  }

  console.log("✓ seed complete");
}

async function bootstrapAdmin(client) {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log("• ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping bootstrap admin");
    return;
  }
  const exists = (
    await client.query("SELECT 1 FROM admin_users WHERE email=$1", [ADMIN_EMAIL])
  ).rowCount;
  if (exists) { console.log(`• admin ${ADMIN_EMAIL} already exists`); return; }
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await client.query(
    `INSERT INTO admin_users (name, email, password_hash, role) VALUES ($1,$2,$3,'super_admin')`,
    [ADMIN_NAME || "Admin", ADMIN_EMAIL, hash]
  );
  console.log(`✓ bootstrap admin created: ${ADMIN_EMAIL}`);
}

const args = process.argv.slice(2);
const client = await pool.connect();
try {
  if (args.includes("--fresh")) await dropAll(client);
  if (!args.includes("--seed-only")) await migrate(client);
  if (!args.includes("--migrate-only")) {
    await seed(client);
    await bootstrapAdmin(client);
  }
  console.log("\n✓ Setup finished. Run `npm run dev` and open http://localhost:3000");
} catch (e) {
  console.error("✗ Setup failed:", e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
