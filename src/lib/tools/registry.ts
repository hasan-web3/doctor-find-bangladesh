// ---------------------------------------------------------------------------
// HEALTH TOOL REGISTRY
// ---------------------------------------------------------------------------
// The single source of truth for the /tools section: which tools exist, what
// they are called in both languages, which specialty a result should hand the
// visitor off to, and whether they are live yet.
//
// Deliberately dependency-free and NOT `server-only`. The navbar, the index
// page's search box and the calculators themselves are client components, and
// the sitemap builder and admin dashboard are server code — all of them read
// this same list, so it has to be importable from either side.
//
// Every calculator here is a pure function of what the visitor types. Nothing
// is written to the database, nothing is sent to an API, and no result is
// persisted anywhere. That is a product decision, not an implementation detail:
// health input is the most sensitive category of data the site could hold, and
// the cheapest way to protect it is never to receive it. It also means a tool
// page is fully static — one prerender serves every visitor forever.
//
// ---------------------------------------------------------------------------
// RULES FOR ADDING A TOOL. Read before extending this array.
// ---------------------------------------------------------------------------
// 1. The maths must come from a published standard (WHO, ACOG, NICE, IOM,
//    DGHS). Record it in `source` — it is rendered on the page, which is both
//    an honesty requirement and the E-E-A-T signal that makes these pages rank.
// 2. No tool may name a disease or tell anyone they are healthy. Results
//    describe a range and point at a doctor. Diagnosis is a BMDC-registered
//    practitioner's job, and a directory that crosses that line stops being a
//    directory.
// 3. No tool may compute a medicine dose.
// 4. `specialties` lists slugs to hand off to. They are matched against the
//    live specialty table at render time, so a slug that does not exist (or has
//    no doctors) is silently dropped rather than producing a dead link.
// ---------------------------------------------------------------------------

/**
 * The date the content of these tools was last checked against its sources.
 *
 * Emitted as `lastReviewed` on every tool page's MedicalWebPage markup, which
 * is one of the properties Google's guidance on health content specifically
 * looks for. BUMP IT whenever a formula, a band boundary, a guidance paragraph
 * or a cited standard changes — a stale review date on a health page is worse
 * than none, because it asserts a check that did not happen.
 */
export const TOOLS_LAST_REVIEWED = "2026-08-21";

export type ToolStatus = "live" | "planned";

export type ToolCategory = "body" | "maternity" | "child" | "lifestyle";

export type ToolDef = {
  key: string;
  /** URL segment under /tools. Never change one without adding a redirect. */
  slug: string;
  status: ToolStatus;
  category: ToolCategory;
  /** Icon name resolved by <Icon>: ICON_MAP (lucide) or the legacy path set. */
  icon: string;
  /** Card accent. bg is the tile behind the icon, fg the icon itself. */
  bg: string;
  fg: string;
  /** Ordering on the index page and in the navbar submenu. */
  sort: number;
  /**
   * Shown by default when the admin has expressed no opinion. New tools go
   * live on deploy instead of waiting for someone to find the toggle.
   */
  defaultEnabled: boolean;
  /** Specialty slugs a result hands off to, best match first. */
  specialties: string[];
  name: { bn: string; en: string };
  /** One line under the card title. Says what it does, not how. */
  tagline: { bn: string; en: string };
  /** The "what is this for" guide block at the top of the tool page. */
  purpose: { bn: string; en: string };
  /** Standards the maths comes from. Rendered verbatim under the result. */
  source: { bn: string; en: string };
  /** Extra match terms for the index page's search box. */
  keywords: { bn: string[]; en: string[] };
  /**
   * Questions the page answers in prose, emitted as FAQPage JSON-LD.
   *
   * These are not filler. A calculator on its own is a thin page: the maths is
   * behind JavaScript, so what a crawler sees is a heading and a form. The FAQ
   * is where the page earns its place, because it is the part that answers the
   * query somebody actually typed, and it is what makes the URL eligible for
   * the FAQ rich result. Every answer is rendered on the page as well.
   */
  faqs: { q: { bn: string; en: string }; a: { bn: string; en: string } }[];
};

export const TOOLS: ToolDef[] = [
  {
    key: "bmi",
    slug: "bmi-calculator",
    status: "live",
    category: "body",
    icon: "PersonStanding",
    bg: "#F0FDFA",
    fg: "#0F766E",
    sort: 1,
    defaultEnabled: true,
    specialties: ["nutrition-dietetics", "endocrinology", "thyroid", "medicine", "nutrition", "diabetes"],
    name: { bn: "বিএমআই ক্যালকুলেটর", en: "BMI Calculator" },
    tagline: {
      bn: "উচ্চতা ও ওজন দিয়ে শরীরের ওজন সঠিক আছে কিনা দেখুন",
      en: "Check whether your weight suits your height",
    },
    purpose: {
      bn: "বিএমআই (বডি মাস ইনডেক্স) উচ্চতার তুলনায় আপনার ওজন কম, স্বাভাবিক না বেশি তার একটি সহজ মাপ। দক্ষিণ এশিয়ার মানুষের ক্ষেত্রে কম বিএমআই-তেই ডায়াবেটিস ও হৃদরোগের ঝুঁকি বাড়ে, তাই এখানে আন্তর্জাতিক মান ও এশীয় মান দুটোই আলাদা করে দেখানো হয়।",
      en: "BMI (Body Mass Index) is a simple measure of whether your weight is low, healthy or high for your height. South Asians face diabetes and heart risk at a lower BMI than other populations, so this tool shows both the international and the Asian cut-offs side by side.",
    },
    source: {
      bn: "WHO বিএমআই শ্রেণিবিভাগ এবং WHO Expert Consultation (Lancet, ২০০৪) এর এশীয় কাট-অফ।",
      en: "WHO BMI classification, plus the Asian cut-offs from the WHO Expert Consultation (Lancet, 2004).",
    },
    keywords: {
      bn: ["বিএমআই", "বডি মাস ইনডেক্স", "ওজন", "উচ্চতা", "মোটা", "স্থূলতা", "ওজন কমানো"],
      en: ["bmi", "body mass index", "weight", "height", "obesity", "overweight", "underweight"],
    },
    faqs: [
      {
        q: { bn: "বাংলাদেশে স্বাভাবিক বিএমআই কত?", en: "What is a normal BMI in Bangladesh?" },
        a: {
          bn: "দক্ষিণ এশিয়ার মানুষের জন্য WHO-এর নির্দেশিকা অনুযায়ী ১৮.৫ থেকে ২২.৯ পর্যন্ত বিএমআই স্বাভাবিক ধরা হয়। ২৩ থেকে শুরু করে ওজন বেশি এবং ২৭.৫ বা তার বেশি হলে স্থূলতা ধরা হয়। আন্তর্জাতিক চার্টে সীমাগুলো যথাক্রমে ২৫ ও ৩০, কিন্তু আমাদের শরীরে একই বিএমআই-তে চর্বি বেশি থাকায় ঝুঁকি আগেই শুরু হয়।",
          en: "For South Asians, WHO guidance treats 18.5 to 22.9 as the healthy band. From 23 the weight counts as raised, and 27.5 or above as obese. The international chart uses 25 and 30, but South Asian bodies carry more fat at the same BMI, so the risk begins earlier.",
        },
      },
      {
        q: { bn: "বিএমআই দিয়ে কি সব বোঝা যায়?", en: "Does BMI tell the whole story?" },
        a: {
          bn: "না। বিএমআই শুধু উচ্চতা ও ওজনের অনুপাত দেখে, চর্বি আর পেশি আলাদা করতে পারে না। খেলোয়াড় বা বেশি পেশিসম্পন্ন মানুষের বিএমআই বেশি আসতে পারে যদিও তারা সুস্থ। আবার পেটের চর্বি বেশি হলে বিএমআই স্বাভাবিক থেকেও ঝুঁকি থাকতে পারে, তাই কোমরের মাপও দেখা দরকার।",
          en: "No. BMI only compares height and weight, so it cannot separate fat from muscle. An athlete can score high while being perfectly healthy, and someone with a normal BMI can still carry risky fat around the waist, which is why waist measurement matters too.",
        },
      },
      {
        q: { bn: "শিশুদের বিএমআই কি একইভাবে হিসাব হয়?", en: "Is BMI calculated the same way for children?" },
        a: {
          bn: "সংখ্যাটি একইভাবে বের হয়, কিন্তু ব্যাখ্যা আলাদা। ১৮ বছরের কম বয়সীদের ক্ষেত্রে বয়স ও লিঙ্গ অনুযায়ী গ্রোথ চার্টের পার্সেন্টাইল দেখে বিচার করতে হয়, প্রাপ্তবয়স্কদের সীমা তাদের ওপর প্রযোজ্য নয়। শিশুর ওজন নিয়ে দুশ্চিন্তা থাকলে শিশু বিশেষজ্ঞের সাথে কথা বলুন।",
          en: "The number is worked out the same way but read differently. Under 18 it must be compared against growth-chart percentiles for the child's age and sex; adult bands do not apply. If you are worried about a child's weight, see a paediatrician.",
        },
      },
      {
        q: { bn: "বিএমআই বেশি হলে কী করব?", en: "What should I do if my BMI is high?" },
        a: {
          bn: "প্রথমে রক্তে শর্করা ও রক্তচাপ একবার পরীক্ষা করিয়ে নিন, কারণ ওজনের সাথে এ দুটির সম্পর্ক সবচেয়ে ঘনিষ্ঠ। বর্তমান ওজনের ৫ থেকে ১০ শতাংশ কমাতে পারলেই ঝুঁকি অনেকটা কমে। নিজে থেকে কড়া ডায়েট শুরু না করে একজন পুষ্টিবিদ বা মেডিসিন বিশেষজ্ঞের পরামর্শ নেওয়া ভালো।",
          en: "Start by getting blood sugar and blood pressure checked, since those are the two most closely tied to weight. Losing 5 to 10 percent of your current weight already brings much of the risk down. Rather than starting a strict diet alone, it is better to see a nutritionist or a general physician.",
        },
      },
    ],
  },
  {
    key: "calorie",
    slug: "calorie-calculator",
    status: "live",
    category: "body",
    icon: "Carrot",
    bg: "#FFF7ED",
    fg: "#C2410C",
    sort: 2,
    defaultEnabled: true,
    specialties: ["nutrition-dietetics", "endocrinology", "medicine", "nutrition"],
    name: { bn: "দৈনিক ক্যালরির হিসাব", en: "Daily Calorie Calculator" },
    tagline: {
      bn: "দিনে কত ক্যালরি দরকার আর ওজন কমাতে কত খাবেন",
      en: "How many calories you need a day, and for your goal",
    },
    purpose: {
      bn: "আপনার শরীর বিশ্রামে থাকলে কত ক্যালরি পোড়ায় (BMR) আর সারাদিনের কাজকর্ম মিলিয়ে মোট কত দরকার (TDEE) তা হিসাব করে। এরপর ওজন ধরে রাখা, কমানো বা বাড়ানোর জন্য দিনে কত ক্যালরি খাওয়া নিরাপদ তা দেখায়।",
      en: "Works out how many calories your body burns at rest (BMR) and across a full day (TDEE), then shows a safe daily intake for keeping, losing or gaining weight.",
    },
    source: {
      bn: "Mifflin-St Jeor সমীকরণ (BMR), এবং IOM-এর Acceptable Macronutrient Distribution Range (AMDR) অনুযায়ী পুষ্টি বিভাজন।",
      en: "Mifflin-St Jeor equation for BMR, with the macronutrient split inside the IOM's Acceptable Macronutrient Distribution Range (AMDR).",
    },
    keywords: {
      bn: ["ক্যালরি", "বিএমআর", "খাদ্য", "ডায়েট", "ওজন কমানো", "ওজন বাড়ানো", "পুষ্টি"],
      en: ["calorie", "bmr", "tdee", "diet", "weight loss", "weight gain", "nutrition", "macros"],
    },
    faqs: [
      {
        q: { bn: "BMR আর TDEE-এর পার্থক্য কী?", en: "What is the difference between BMR and TDEE?" },
        a: {
          bn: "BMR হলো আপনি সারাদিন শুয়ে থাকলেও শরীর যতটুকু ক্যালরি পোড়াবে, অর্থাৎ শ্বাস নেওয়া, হৃদস্পন্দন ও অঙ্গ চালানোর খরচ। TDEE হলো এর সাথে হাঁটাচলা, কাজ ও ব্যায়ামের খরচ যোগ করে দিনের মোট খরচ। ওজন ধরে রাখতে TDEE পরিমাণ ক্যালরি খেতে হয়।",
          en: "BMR is what your body burns if you lay still all day, just breathing, pumping blood and running your organs. TDEE adds movement, work and exercise on top, giving the full daily burn. Eating around your TDEE keeps your weight steady.",
        },
      },
      {
        q: { bn: "ওজন কমাতে দিনে কত ক্যালরি কমাতে হবে?", en: "How many calories should I cut to lose weight?" },
        a: {
          bn: "দিনে প্রায় ৫০০ ক্যালরি কম খেলে সপ্তাহে মোটামুটি আধা কেজি কমে, এটাই নিরাপদ গতি। এর চেয়ে দ্রুত কমাতে গেলে চর্বির সাথে পেশিও কমে যায় এবং পরে ওজন ফিরে আসার আশঙ্কা বেশি থাকে।",
          en: "About 500 calories less a day takes off roughly half a kilo a week, which is the safe pace. Cutting faster costs muscle as well as fat and makes the weight more likely to come back.",
        },
      },
      {
        q: { bn: "দিনে সর্বনিম্ন কত ক্যালরি খাওয়া নিরাপদ?", en: "What is the lowest safe daily calorie intake?" },
        a: {
          bn: "ডাক্তারের তত্ত্বাবধান ছাড়া নারীদের ক্ষেত্রে দিনে ১২০০ এবং পুরুষদের ক্ষেত্রে ১৫০০ ক্যালরির নিচে যাওয়া ঠিক নয়। এর কম খেলে প্রয়োজনীয় ভিটামিন, খনিজ ও প্রোটিন পাওয়া কঠিন হয়ে পড়ে। এই টুলটি সেই সীমার নিচে কোনো লক্ষ্য দেখায় না।",
          en: "Without medical supervision it is not advisable to go below 1200 calories a day for women or 1500 for men. Below that it becomes hard to get enough vitamins, minerals and protein. This tool will not show a target under those floors.",
        },
      },
      {
        q: { bn: "এই হিসাব কি সবার জন্য সঠিক?", en: "Is this figure accurate for everyone?" },
        a: {
          bn: "এটি একটি ভালো আনুমানিক হিসাব, নিখুঁত নয়। একই উচ্চতা ও ওজনের দুজন মানুষের প্রকৃত খরচ কিছুটা আলাদা হতে পারে। গর্ভবতী বা দুগ্ধদানকারী মা, ক্রীড়াবিদ এবং ডায়াবেটিস, কিডনি বা থাইরয়েডের সমস্যা থাকলে হিসাব আলাদা হবে, তাই ডাক্তার বা পুষ্টিবিদের পরামর্শ নিন।",
          en: "It is a good estimate, not an exact figure. Two people of the same height and weight can burn somewhat differently. Pregnant or breastfeeding women, athletes, and anyone with diabetes, kidney or thyroid problems need a different calculation, so please check with a doctor or dietitian.",
        },
      },
    ],
  },
  {
    key: "due-date",
    slug: "pregnancy-due-date",
    status: "live",
    category: "maternity",
    icon: "Baby",
    bg: "#FDF2F8",
    fg: "#BE185D",
    sort: 3,
    defaultEnabled: true,
    specialties: ["gynecology", "obstetrics", "gynecology-obstetrics", "neonatology", "gynae"],
    name: { bn: "প্রেগন্যান্সি ডিউ ডেট ক্যালকুলেটর", en: "Pregnancy Due Date Calculator" },
    tagline: {
      bn: "সন্তান জন্মের সম্ভাব্য তারিখ ও এখন কত সপ্তাহ চলছে",
      en: "Your estimated delivery date and current pregnancy week",
    },
    purpose: {
      bn: "শেষ মাসিকের প্রথম দিনের তারিখ দিলে সন্তান জন্মের সম্ভাব্য তারিখ (EDD), এখন গর্ভাবস্থার কত সপ্তাহ চলছে, কোন ত্রৈমাসিক এবং কখন কোন চেকআপ দরকার তা দেখাবে।",
      en: "Enter the first day of your last period to get an estimated delivery date (EDD), how many weeks along you are today, which trimester you are in, and when each checkup is due.",
    },
    source: {
      bn: "Naegele-এর নিয়ম (শেষ মাসিক + ২৮০ দিন), ACOG-এর গর্ভকালীন তারিখ নির্ধারণ নির্দেশিকা, এবং WHO-এর ৮ বার প্রসবপূর্ব সেবার মডেল (২০১৬)।",
      en: "Naegele's rule (LMP + 280 days), ACOG guidance on pregnancy dating, and the WHO 2016 eight-contact antenatal care model.",
    },
    keywords: {
      bn: ["প্রেগন্যান্সি", "গর্ভাবস্থা", "ডেলিভারি", "ডিউ ডেট", "সন্তান", "মাসিক", "গর্ভবতী", "সপ্তাহ"],
      en: ["pregnancy", "due date", "edd", "delivery", "gestational age", "lmp", "trimester", "antenatal"],
    },
    faqs: [
      {
        q: { bn: "ডিউ ডেট কীভাবে হিসাব করা হয়?", en: "How is the due date calculated?" },
        a: {
          bn: "শেষ মাসিক শুরু হওয়ার দিন থেকে ২৮০ দিন (৪০ সপ্তাহ) যোগ করে সম্ভাব্য তারিখ বের করা হয়, একে Naegele-এর নিয়ম বলে। এই নিয়মটি ২৮ দিনের চক্র ধরে নেয়, তাই আপনার চক্র লম্বা বা ছোট হলে সেই পার্থক্য অনুযায়ী তারিখটি সরিয়ে নেওয়া হয়।",
          en: "280 days (40 weeks) are added to the first day of your last period. This is Naegele's rule. It assumes a 28-day cycle, so if yours is longer or shorter the date is shifted by the difference.",
        },
      },
      {
        q: { bn: "সন্তান কি ঠিক এই তারিখেই জন্মাবে?", en: "Will the baby arrive on exactly that date?" },
        a: {
          bn: "সাধারণত না। প্রায় ২০ জনের মধ্যে ১ জনের সন্তান ঠিক সম্ভাব্য তারিখে জন্মায়, বাকিরা তার আগে বা পরে জন্ম নেয়। ৩৭ থেকে ৪২ সপ্তাহের মধ্যে জন্ম হওয়া স্বাভাবিক ধরা হয়। তারিখটিকে একটি সময়সীমা হিসেবে দেখুন, নির্দিষ্ট দিন হিসেবে নয়।",
          en: "Usually not. About 1 baby in 20 arrives on the estimated date and the rest come earlier or later. Birth between 37 and 42 weeks is considered normal. Treat the date as a window, not a fixed day.",
        },
      },
      {
        q: { bn: "শেষ মাসিকের তারিখ মনে না থাকলে কী করব?", en: "What if I do not remember my last period date?" },
        a: {
          bn: "তাহলে এই হিসাবটি নির্ভরযোগ্য হবে না। এ ক্ষেত্রে আল্ট্রাসাউন্ডই একমাত্র নির্ভরযোগ্য উপায়, এবং প্রথম তিন মাসের মধ্যে করা আল্ট্রাসাউন্ড সবচেয়ে নির্ভুল তারিখ দেয়। দ্রুত একজন গাইনোকোলজিস্টের সাথে যোগাযোগ করুন।",
          en: "Then this calculation will not be reliable. An ultrasound is the only dependable alternative, and one done in the first three months gives the most accurate date. Please see a gynaecologist soon.",
        },
      },
      {
        q: { bn: "গর্ভাবস্থায় কতবার চেকআপ করানো উচিত?", en: "How many antenatal checkups are needed?" },
        a: {
          bn: "বিশ্ব স্বাস্থ্য সংস্থা ২০১৬ সাল থেকে গর্ভাবস্থায় অন্তত ৮ বার চেকআপের পরামর্শ দেয়। বাংলাদেশের জাতীয় নির্দেশিকায় সর্বনিম্ন ৪ বারের কথা বলা আছে, তবে যত বেশিবার দেখানো যায় ততই ভালো, বিশেষ করে উচ্চ রক্তচাপ বা ডায়াবেটিস থাকলে।",
          en: "Since 2016 the World Health Organization has recommended at least 8 antenatal contacts. Bangladesh's national guideline sets a minimum of 4, but more visits are better, especially with high blood pressure or diabetes.",
        },
      },
    ],
  },

  // -------------------------------------------------------------------------
  // PLANNED. Listed here so the admin dashboard, the index page's "coming
  // soon" row and this comment stay in one place — but `status: "planned"`
  // keeps them out of the router, the navbar and the sitemap entirely, so a
  // planned tool costs nothing until its calculator is written.
  // -------------------------------------------------------------------------
  {
    key: "vaccine",
    slug: "child-vaccination-schedule",
    status: "planned",
    category: "child",
    icon: "Syringe",
    bg: "#EFF6FF",
    fg: "#1D4ED8",
    sort: 4,
    defaultEnabled: true,
    specialties: ["pediatrics", "neonatology", "child"],
    name: { bn: "শিশুর টিকার সময়সূচি", en: "Child Vaccination Schedule" },
    tagline: {
      bn: "জন্মতারিখ দিলে EPI অনুযায়ী প্রতিটি টিকার তারিখ",
      en: "Every EPI vaccine date from your child's birth date",
    },
    purpose: {
      bn: "শিশুর জন্মতারিখ দিলে বাংলাদেশের সম্প্রসারিত টিকাদান কর্মসূচি (EPI) অনুযায়ী কোন টিকা কবে দিতে হবে তার পূর্ণ তালিকা তৈরি করে।",
      en: "Turns your child's date of birth into the full list of vaccine dates under Bangladesh's Expanded Programme on Immunization (EPI).",
    },
    source: {
      bn: "স্বাস্থ্য অধিদপ্তরের (DGHS) জাতীয় EPI সময়সূচি।",
      en: "The national EPI schedule published by the Directorate General of Health Services (DGHS).",
    },
    keywords: {
      bn: ["টিকা", "ইপিআই", "শিশু", "ভ্যাকসিন", "বিসিজি", "পেন্টা"],
      en: ["vaccine", "vaccination", "epi", "immunization", "child", "bcg", "penta"],
    },
    faqs: [],
  },
  {
    key: "healthy-weight",
    slug: "healthy-weight-range",
    status: "planned",
    category: "body",
    icon: "Scan",
    bg: "#ECFDF5",
    fg: "#059669",
    sort: 5,
    defaultEnabled: true,
    specialties: ["nutrition-dietetics", "medicine", "nutrition"],
    name: { bn: "আদর্শ ওজনের সীমা", en: "Healthy Weight Range" },
    tagline: {
      bn: "আপনার উচ্চতার জন্য স্বাস্থ্যকর ওজনের সীমা",
      en: "The healthy weight range for your height",
    },
    purpose: {
      bn: "উচ্চতা থেকে স্বাস্থ্যকর ওজনের একটি সীমা বের করে। একটি নির্দিষ্ট সংখ্যা নয়, কারণ কোনো একটি সংখ্যাকে সবার জন্য আদর্শ ওজন বলা যায় না।",
      en: "Derives a healthy weight range from your height. A range, not one number, because no single figure is the right weight for everyone.",
    },
    source: {
      bn: "WHO-এর এশীয় বিএমআই সীমা (১৮.৫ থেকে ২২.৯) উচ্চতা থেকে ওজনে রূপান্তর করে।",
      en: "The WHO Asian BMI band (18.5 to 22.9) converted back from height to weight.",
    },
    keywords: {
      bn: ["আদর্শ ওজন", "ওজন", "উচ্চতা", "সঠিক ওজন"],
      en: ["ideal weight", "healthy weight", "weight range", "height"],
    },
    faqs: [],
  },
];

// ---------------------------------------------------------------------------
// lookups
// ---------------------------------------------------------------------------

export const LIVE_TOOLS: ToolDef[] = TOOLS.filter((t) => t.status === "live").sort(
  (a, b) => a.sort - b.sort,
);

export function toolBySlug(slug: string): ToolDef | null {
  return TOOLS.find((t) => t.slug === slug) ?? null;
}

export function toolByKey(key: string): ToolDef | null {
  return TOOLS.find((t) => t.key === key) ?? null;
}

/** The admin's on/off map, as stored under the `tools_enabled` settings key. */
export type ToolToggles = Record<string, boolean>;

/**
 * Is this tool visible to the public right now?
 *
 * `planned` always loses — an admin cannot switch on a calculator that has no
 * implementation behind it. Otherwise the admin's explicit choice wins, and
 * with no choice recorded the registry's own default applies. That ordering is
 * what lets a newly shipped tool appear without anyone touching the dashboard.
 */
export function isToolOn(tool: ToolDef, toggles: ToolToggles | undefined | null): boolean {
  if (tool.status !== "live") return false;
  const explicit = toggles?.[tool.key];
  return typeof explicit === "boolean" ? explicit : tool.defaultEnabled;
}

/** Every publicly visible tool, in display order. */
export function enabledTools(toggles: ToolToggles | undefined | null): ToolDef[] {
  return LIVE_TOOLS.filter((t) => isToolOn(t, toggles));
}

/**
 * Tools worth surfacing next to a given specialty.
 *
 * This is the cross-link that ties the calculators to the directory: someone
 * reading the endocrinology hub is one click from the BMI tool, and someone
 * who just calculated a high BMI is one click from an endocrinologist. Matching
 * is on specialty slug, so it costs nothing at request time.
 */
export function toolsForSpecialty(
  specialtySlug: string,
  toggles: ToolToggles | undefined | null,
): ToolDef[] {
  const slug = specialtySlug.toLowerCase();
  return enabledTools(toggles).filter((t) => t.specialties.includes(slug));
}

export function toolPath(tool: ToolDef): string {
  return `/tools/${tool.slug}`;
}
