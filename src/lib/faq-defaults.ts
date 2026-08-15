import { num, type Locale } from "./i18n";
import { withSpecialistSuffix } from "./bn";

// ---------------------------------------------------------------------------
// GENERATED FAQs.
//
// Every landing page that can carry an FAQ block gets one automatically, built
// from that entity's OWN data. Nothing is stored: these are produced at render
// time, so a district that gains its first doctor gets an FAQ block on the next
// revalidation and loses it again if that doctor goes away.
//
// The gate is deliberately the same one the sitemap uses. A generator returns
// an empty array when the entity has no doctors, which is exactly when
// sitemap-core.ts refuses to advertise its URL and generateMetadata marks it
// `noindex`. So a page has generated FAQs if and only if it is a page we want
// indexed. (Hospitals are the documented exception in the sitemap and stay
// indexable with zero doctors, so their generator keeps working too.)
//
// WHY THIS IS NOT BOILERPLATE
// ---------------------------
// The one real risk with generated content at this scale is publishing the same
// paragraph under a thousand URLs, which reads as doorway content. Every answer
// below is therefore built from values that differ per entity: the actual thana
// names, the actual specialties practised there, the actual hospitals, the
// actual counts. Two districts never produce the same sentence unless they
// genuinely have the same doctors. Where a fact is not known (a fee, a
// schedule) the answer points at where it IS shown rather than inventing it.
//
// Admin overrides: see migrations/018. A saved edit replaces one of these by
// `key`; a delete suppresses it. Nothing here is forced on the admin.
// ---------------------------------------------------------------------------

export type MLPair = { bn: string; en: string };
export type FaqSeed = { key: string; question: MLPair; answer: MLPair };

/** "ক, খ ও গ" / "a, b and c", capped so a sentence never runs away. */
function list(names: string[], locale: Locale, max = 6): string {
  const clean = names.map((n) => (n || "").trim()).filter(Boolean).slice(0, max);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  const head = clean.slice(0, -1).join(", ");
  const tail = clean[clean.length - 1];
  return locale === "bn" ? `${head} ও ${tail}` : `${head} and ${tail}`;
}

/** Both scripts of a count, so a seed can build bn and en in one pass. */
function n(value: number): MLPair {
  return { bn: num(value, "bn"), en: num(value, "en") };
}

// ---------------------------------------------------------------------------
// District
// ---------------------------------------------------------------------------
export function districtFaqSeeds(ctx: {
  name: string;
  doctorCount: number;
  thanas: string[];
  specialties: string[];
  hospitals: string[];
}): FaqSeed[] {
  // Same rule as the sitemap: no doctors, no indexable page, no FAQ.
  if (ctx.doctorCount <= 0) return [];

  const { name } = ctx;
  const c = n(ctx.doctorCount);
  const seeds: FaqSeed[] = [
    {
      key: "how_find",
      question: {
        bn: `${name}য় ভালো ডাক্তার কীভাবে খুঁজে পাব?`,
        en: `How do I find a good doctor in ${name}?`,
      },
      answer: {
        bn: `বিশেষজ্ঞ বিভাগ, এলাকা বা হাসপাতাল অনুযায়ী ফিল্টার করে খুঁজতে পারেন। প্রতিটি প্রোফাইলে ডিগ্রি, অভিজ্ঞতা, চেম্বারের ঠিকানা, বসার সময় ও ভিজিট ফি দেওয়া আছে, তাই বাসা থেকে বের হওয়ার আগেই আপনি জানতে পারবেন কোথায় কখন যেতে হবে।`,
        en: `Filter by specialty, area or hospital. Every profile lists degrees, experience, chamber address, sitting hours and visit fee, so you know where to go and when before you leave home.`,
      },
    },
    {
      key: "count",
      question: {
        bn: `${name}য় কতজন ডাক্তারের তথ্য এখানে আছে?`,
        en: `How many doctors in ${name} are listed here?`,
      },
      answer: {
        bn: `এই মুহূর্তে ${c.bn} জন ডাক্তারের তথ্য আছে, এবং নিয়মিত নতুন ডাক্তার যুক্ত হচ্ছে। প্রতিটি প্রোফাইলের তথ্য চেম্বার বা হাসপাতালের সাথে মিলিয়ে দেখা হয়।`,
        en: `${c.en} doctors are listed at the moment, and new ones are added regularly. Every profile is cross-checked with the chamber or hospital.`,
      },
    },
  ];

  if (ctx.thanas.length > 0) {
    seeds.push({
      key: "areas",
      question: {
        bn: `${name}র কোন কোন এলাকায় ডাক্তারের চেম্বার আছে?`,
        en: `Which areas of ${name} have doctors' chambers?`,
      },
      answer: {
        bn: `${list(ctx.thanas, "bn")} সহ বিভিন্ন এলাকায় চেম্বার আছে। এই পেজের "এলাকা অনুযায়ী ডাক্তার" অংশ থেকে আপনার সবচেয়ে কাছের থানা বেছে নিলে সেখানকার ডাক্তারদের তালিকা দেখতে পাবেন।`,
        en: `Chambers are spread across ${list(ctx.thanas, "en")}, among others. Use the "Doctors by Area" section on this page to pick the thana nearest to you and see its doctors.`,
      },
    });
  }

  if (ctx.specialties.length > 0) {
    seeds.push({
      key: "specialties",
      question: {
        bn: `${name}য় কোন কোন বিষয়ের বিশেষজ্ঞ ডাক্তার আছেন?`,
        en: `Which specialties are available in ${name}?`,
      },
      answer: {
        bn: `${list(ctx.specialties, "bn", 8)} সহ আরও অনেক বিভাগের বিশেষজ্ঞ ডাক্তার তালিকায় আছেন। পুরো তালিকা এই পেজের "বিশেষজ্ঞ বিভাগ" অংশে পাবেন।`,
        en: `${list(ctx.specialties, "en", 8)} and more. The full list is in the "Specialties" section on this page.`,
      },
    });
  }

  if (ctx.hospitals.length > 0) {
    seeds.push({
      key: "hospitals",
      question: {
        bn: `${name}র কোন হাসপাতালে বিশেষজ্ঞ ডাক্তার পাওয়া যায়?`,
        en: `Which hospitals in ${name} have specialist doctors?`,
      },
      answer: {
        bn: `${list(ctx.hospitals, "bn", 5)} সহ বিভিন্ন হাসপাতাল ও ক্লিনিকের ডাক্তারদের তথ্য এখানে পাবেন। হাসপাতাল অনুযায়ী দেখতে "হাসপাতাল ও ক্লিনিক" অংশ থেকে বেছে নিন।`,
        en: `You will find doctors from ${list(ctx.hospitals, "en", 5)}, among others. Use the "Hospitals and Clinics" section to browse by hospital.`,
      },
    });
  }

  seeds.push(
    {
      key: "fees",
      question: {
        bn: `${name}য় ডাক্তার দেখাতে ভিজিট ফি কত?`,
        en: `What is the visit fee to see a doctor in ${name}?`,
      },
      answer: {
        bn: `ভিজিট ফি ডাক্তার, বিশেষজ্ঞ বিভাগ ও চেম্বার অনুযায়ী আলাদা হয়। প্রতিটি ডাক্তারের প্রোফাইলে তার বর্তমান ফি লেখা থাকে, আর তালিকার ফিল্টার থেকে আপনি নির্দিষ্ট ফি সীমার মধ্যে ডাক্তার খুঁজে নিতে পারেন।`,
        en: `Visit fees vary by doctor, specialty and chamber. Each profile shows that doctor's current fee, and the listing filter lets you narrow the list to a fee range that suits you.`,
      },
    },
    {
      key: "appointment",
      question: {
        bn: `${name}য় ডাক্তারের অ্যাপয়েন্টমেন্ট নেব কীভাবে?`,
        en: `How do I book an appointment with a doctor in ${name}?`,
      },
      answer: {
        bn: `পছন্দের ডাক্তারের প্রোফাইলে গিয়ে "অ্যাপয়েন্টমেন্ট নিন" বাটনে চাপুন, চেম্বার ও সময় বেছে নিন, তারপর আপনার নাম ও মোবাইল নম্বর দিন। চাইলে চেম্বারের নম্বরে সরাসরি কল করেও সময় নিতে পারেন।`,
        en: `Open the doctor's profile, tap "Book Appointment", choose the chamber and time, then enter your name and mobile number. You can also call the chamber number directly to arrange a time.`,
      },
    },
    EMERGENCY_SEED,
  );

  return seeds;
}

// The one seed that is identical everywhere, on purpose. Health content is
// YMYL, and the safe-handling instruction must not vary by district.
const EMERGENCY_SEED: FaqSeed = {
  key: "emergency",
  question: {
    bn: "রাতে বা জরুরি অবস্থায় কী করব?",
    en: "What should I do at night or in an emergency?",
  },
  answer: {
    bn: "জরুরি অবস্থায় দেরি না করে নিকটস্থ হাসপাতালের জরুরি বিভাগে যান, অথবা জাতীয় জরুরি সেবা ৯৯৯ নম্বরে কল করুন। এই সাইটের তালিকা ডাক্তারদের নির্ধারিত চেম্বারের সময়সূচি অনুযায়ী, এটি জরুরি সেবার বিকল্প নয়।",
    en: "In an emergency go straight to the nearest hospital's emergency department, or call the national emergency number 999. The listings here follow doctors' scheduled chamber hours and are not a substitute for emergency care.",
  },
};

// ---------------------------------------------------------------------------
// Seeds every scope can offer, named after the thing the page is about so no
// two pages publish a byte-identical answer.
//
// These exist to guarantee the floor: each generator below must produce at
// least five FAQs for a qualifying page, and an entity with sparse data (a
// thana with no specialties recorded, a doctor with no chamber) would otherwise
// fall short. Data-driven seeds still come first, so the useful, specific
// answers are the ones people see at the top.
// ---------------------------------------------------------------------------

/** "Is this information reliable?" — the trust question, per subject. */
function verifiedSeed(subject: MLPair): FaqSeed {
  return {
    key: "verified",
    question: {
      bn: `${subject.bn} এর তথ্য কি যাচাই করা?`,
      en: `Is the information about ${subject.en} verified?`,
    },
    answer: {
      bn: "যাচাইকৃত ব্যাজ থাকা প্রোফাইলের নাম, ডিগ্রি, চেম্বারের ঠিকানা ও সময়সূচি আমরা চেম্বার বা হাসপাতালের সাথে মিলিয়ে দেখেছি। সময় ও ফি মাঝে মাঝে বদলায়, তাই কোনো তথ্য ভুল মনে হলে আমাদের জানাবেন, আমরা যাচাই করে সংশোধন করব।",
      en: "Profiles carrying the verified badge have had their name, degrees, chamber address and schedule cross-checked with the chamber or hospital. Hours and fees do change, so if something looks wrong please tell us and we will check and correct it.",
    },
  };
}

/** "How do I reach someone?" — the helpline fallback. */
function contactSeed(subject: MLPair): FaqSeed {
  return {
    key: "contact",
    question: {
      bn: `${subject.bn} নিয়ে সাহায্য দরকার হলে কোথায় যোগাযোগ করব?`,
      en: `Who do I contact for help with ${subject.en}?`,
    },
    answer: {
      bn: "প্রতিটি চেম্বারের নিজস্ব ফোন নম্বর প্রোফাইলে দেওয়া আছে, সেখানে সরাসরি কল করতে পারেন। নম্বর না পেলে বা কোনো সমস্যা হলে সাইটের হেল্পলাইনে কল করুন, আমরা সঠিক জায়গায় পৌঁছে দেব।",
      en: "Each chamber's own phone number is on the profile, so you can call it directly. If there is no number listed or something is not working, call the site helpline and we will point you to the right place.",
    },
  };
}

/** "What should I do before going?" — practical, and true everywhere. */
function beforeVisitSeed(subject: MLPair): FaqSeed {
  return {
    key: "before_visit",
    question: {
      bn: `${subject.bn} এর কাছে যাওয়ার আগে কী প্রস্তুতি নেব?`,
      en: `What should I prepare before visiting ${subject.en}?`,
    },
    answer: {
      bn: "আগের প্রেসক্রিপশন, রিপোর্ট ও এখন যেসব ওষুধ খাচ্ছেন তার তালিকা সাথে নিন। সমস্যা কবে থেকে ও কেমন হচ্ছে তা লিখে নিলে ডাক্তারকে বলতে সুবিধা হয়। যাওয়ার আগে চেম্বারে একবার ফোন করে সময় নিশ্চিত করে নেওয়া ভালো।",
      en: "Take your previous prescriptions, test reports and a list of the medicines you are currently taking. Noting down when the problem started and how it feels makes it easier to explain. It is worth calling the chamber first to confirm the timing.",
    },
  };
}

// ---------------------------------------------------------------------------
// District × specialty — the highest-intent pages on the site.
//
// Generated only: there is no single entity id behind a pairing, so these carry
// no admin override. That is deliberate rather than a limitation — nobody is
// going to hand-write FAQs for hundreds of combinations, and every answer here
// is built from the pairing's own numbers and places.
// ---------------------------------------------------------------------------
export function districtSpecialtyFaqSeeds(ctx: {
  specialty: string;
  district: string;
  doctorCount: number;
  areas: string[];
  hospitals: string[];
}): FaqSeed[] {
  if (ctx.doctorCount <= 0) return [];

  const { specialty, district } = ctx;
  const c = n(ctx.doctorCount);
  const seeds: FaqSeed[] = [
    {
      key: "how_many",
      question: {
        bn: `${district}য় কতজন ${withSpecialistSuffix(specialty)} আছেন?`,
        en: `How many ${specialty} specialists are there in ${district}?`,
      },
      answer: {
        bn: `এই মুহূর্তে ${district}য় ${c.bn} জন ${withSpecialistSuffix(specialty)}ের তথ্য এখানে আছে। প্রতিটি প্রোফাইলে ডিগ্রি, অভিজ্ঞতা, চেম্বারের ঠিকানা, বসার সময় ও ভিজিট ফি দেওয়া আছে।`,
        en: `${c.en} ${specialty} specialists in ${district} are listed here at the moment. Each profile carries degrees, experience, chamber address, sitting hours and visit fee.`,
      },
    },
  ];

  if (ctx.areas.length > 0) {
    seeds.push({
      key: "areas",
      question: {
        bn: `${district}র কোন কোন এলাকায় ${specialty} ডাক্তার বসেন?`,
        en: `Which areas of ${district} have ${specialty} doctors?`,
      },
      answer: {
        bn: `${list(ctx.areas, "bn", 6)} সহ বিভিন্ন এলাকায় এই বিভাগের ডাক্তার বসেন। আপনার কাছের এলাকা বেছে নিলে শুধু সেখানকার তালিকা দেখতে পাবেন।`,
        en: `${list(ctx.areas, "en", 6)}, among others. Pick the area nearest to you to narrow the list.`,
      },
    });
  }

  if (ctx.hospitals.length > 0) {
    seeds.push({
      key: "hospitals",
      question: {
        bn: `${district}র কোন হাসপাতালে ${withSpecialistSuffix(specialty)} পাওয়া যায়?`,
        en: `Which hospitals in ${district} have ${specialty} specialists?`,
      },
      answer: {
        bn: `${list(ctx.hospitals, "bn", 5)} সহ বিভিন্ন হাসপাতাল ও চেম্বারে এই বিভাগের ডাক্তার রোগী দেখেন। প্রতিটি প্রোফাইলে চেম্বারের নাম ও ঠিকানা দেওয়া আছে।`,
        en: `${list(ctx.hospitals, "en", 5)}, among others. Each profile lists the chamber name and address.`,
      },
    });
  }

  seeds.push(
    {
      key: "fees",
      question: {
        bn: `${district}য় ${specialty} ডাক্তারের ভিজিট ফি কত?`,
        en: `What do ${specialty} doctors in ${district} charge?`,
      },
      answer: {
        bn: `ফি ডাক্তার ও চেম্বার অনুযায়ী আলাদা হয়। প্রতিটি প্রোফাইলে বর্তমান ভিজিট ফি লেখা থাকে, তাই যাওয়ার আগেই আপনি জানতে পারবেন কত লাগবে।`,
        en: `Fees vary by doctor and chamber. Each profile shows the current visit fee, so you know the cost before you go.`,
      },
    },
    {
      key: "appointment",
      question: {
        bn: `${district}য় ${specialty} ডাক্তারের অ্যাপয়েন্টমেন্ট নেব কীভাবে?`,
        en: `How do I book a ${specialty} appointment in ${district}?`,
      },
      answer: {
        bn: `পছন্দের ডাক্তারের প্রোফাইলে গিয়ে "অ্যাপয়েন্টমেন্ট নিন" বাটনে চাপুন, চেম্বার ও সময় বেছে নিন, তারপর নাম ও মোবাইল নম্বর দিন। চেম্বারের নম্বরে সরাসরি কল করেও সময় নেওয়া যায়।`,
        en: `Open the doctor's profile, tap "Book Appointment", choose the chamber and time, then enter your name and mobile number. Calling the chamber directly also works.`,
      },
    },
    beforeVisitSeed({ bn: `${specialty} ডাক্তার`, en: `a ${specialty} doctor` }),
    EMERGENCY_SEED,
  );

  return seeds;
}

// ---------------------------------------------------------------------------
// Thana / upazila
// ---------------------------------------------------------------------------
export function areaFaqSeeds(ctx: {
  name: string;
  district: string;
  doctorCount: number;
  specialties: string[];
}): FaqSeed[] {
  if (ctx.doctorCount <= 0) return [];

  const { name, district } = ctx;
  const where = district ? `${name}, ${district}` : name;
  const c = n(ctx.doctorCount);

  const seeds: FaqSeed[] = [
    {
      key: "how_find",
      question: {
        bn: `${name} এলাকায় ডাক্তার কীভাবে খুঁজব?`,
        en: `How do I find a doctor in ${name}?`,
      },
      answer: {
        bn: `${where} এলাকায় এই মুহূর্তে ${c.bn} জন ডাক্তারের তথ্য আছে। বিভাগ অনুযায়ী ফিল্টার করে, অথবা নিচের তালিকা থেকে সরাসরি প্রোফাইল দেখে চেম্বারের ঠিকানা, সময় ও ফি জেনে নিতে পারেন।`,
        en: `${c.en} doctors are currently listed in ${where}. Filter by specialty, or open a profile from the list below to see the chamber address, hours and fee.`,
      },
    },
  ];

  if (ctx.specialties.length > 0) {
    seeds.push({
      key: "specialties",
      question: {
        bn: `${name} এলাকায় কোন কোন বিশেষজ্ঞ ডাক্তার বসেন?`,
        en: `Which specialists sit in ${name}?`,
      },
      answer: {
        bn: `${list(ctx.specialties, "bn", 8)} বিভাগের ডাক্তাররা এই এলাকায় রোগী দেখেন। নির্দিষ্ট বিভাগের তালিকা দেখতে এই পেজের "বিভাগ অনুযায়ী ডাক্তার" অংশ থেকে বেছে নিন।`,
        en: `Doctors in ${list(ctx.specialties, "en", 8)} see patients in this area. Use the "Doctors by Specialty" section on this page to narrow it down.`,
      },
    });
  }

  seeds.push(
    {
      key: "fees",
      question: {
        bn: `${name} এলাকায় ডাক্তার দেখাতে কত টাকা লাগে?`,
        en: `What does it cost to see a doctor in ${name}?`,
      },
      answer: {
        bn: `ভিজিট ফি ডাক্তার ও চেম্বার অনুযায়ী আলাদা হয়। প্রতিটি প্রোফাইলে বর্তমান ফি লেখা থাকে, আর তালিকার ফিল্টার থেকে নির্দিষ্ট ফি সীমার মধ্যে ডাক্তার বেছে নিতে পারেন।`,
        en: `Visit fees vary by doctor and chamber. Each profile shows the current fee, and the listing filter lets you narrow to a range that suits you.`,
      },
    },
    {
      key: "appointment",
      question: {
        bn: `${name} এলাকার ডাক্তারের অ্যাপয়েন্টমেন্ট নেব কীভাবে?`,
        en: `How do I book an appointment in ${name}?`,
      },
      answer: {
        bn: `ডাক্তারের প্রোফাইলে গিয়ে "অ্যাপয়েন্টমেন্ট নিন" বাটনে চাপুন, চেম্বার ও সময় বেছে নিন, তারপর নাম ও মোবাইল নম্বর দিন। চেম্বারের নম্বরে সরাসরি কল করেও সময় নেওয়া যায়।`,
        en: `Open the doctor's profile, tap "Book Appointment", pick the chamber and time, then enter your name and mobile number. Calling the chamber directly also works.`,
      },
    },
    verifiedSeed({ bn: `${name} এলাকার ডাক্তারদের`, en: `doctors in ${name}` }),
    EMERGENCY_SEED,
  );

  return seeds;
}

// ---------------------------------------------------------------------------
// Specialty
// ---------------------------------------------------------------------------
export function specialtyFaqSeeds(ctx: {
  name: string;
  doctorCount: number;
  /** Thanas where this specialty actually has doctors. */
  areas: string[];
}): FaqSeed[] {
  if (ctx.doctorCount <= 0) return [];

  const { name } = ctx;
  const c = n(ctx.doctorCount);

  const seeds: FaqSeed[] = [
    {
      key: "how_find",
      question: {
        bn: `${withSpecialistSuffix(name)} ডাক্তার কীভাবে বেছে নেব?`,
        en: `How do I choose a ${name} specialist?`,
      },
      answer: {
        bn: `এখানে ${c.bn} জন ${withSpecialistSuffix(name)}ের তথ্য আছে। প্রতিটি প্রোফাইলে ডিগ্রি, অভিজ্ঞতা, চেম্বারের ঠিকানা, বসার সময় ও ভিজিট ফি দেওয়া আছে, তাই আপনার সুবিধামতো এলাকা ও সময় দেখে বেছে নিতে পারেন।`,
        en: `${c.en} ${name} specialists are listed here. Each profile carries degrees, experience, chamber address, sitting hours and visit fee, so you can choose by the area and time that suit you.`,
      },
    },
  ];

  if (ctx.areas.length > 0) {
    seeds.push({
      key: "areas",
      question: {
        bn: `কোন কোন এলাকায় ${name} ডাক্তার পাওয়া যায়?`,
        en: `Which areas have ${name} doctors?`,
      },
      answer: {
        bn: `${list(ctx.areas, "bn", 8)} এলাকায় এই বিভাগের ডাক্তার আছেন। আপনার কাছের এলাকা বেছে নিলে শুধু সেখানকার ${name} ডাক্তারদের তালিকা দেখতে পাবেন।`,
        en: `${list(ctx.areas, "en", 8)} currently have doctors in this specialty. Pick the area nearest to you to see only its ${name} doctors.`,
      },
    });
  }

  seeds.push(
    {
      key: "fees",
      question: {
        bn: `${name} ডাক্তারের ভিজিট ফি কত?`,
        en: `What do ${name} doctors charge?`,
      },
      answer: {
        bn: `ফি ডাক্তার ও চেম্বার অনুযায়ী আলাদা হয়। প্রতিটি প্রোফাইলে বর্তমান ভিজিট ফি লেখা থাকে, আর তালিকার ফিল্টার থেকে নির্দিষ্ট ফি সীমার মধ্যে খুঁজে নিতে পারেন।`,
        en: `Fees vary by doctor and chamber. Each profile shows the current visit fee, and the listing filter lets you narrow to a range that suits you.`,
      },
    },
    {
      key: "appointment",
      question: {
        bn: `${name} ডাক্তারের অ্যাপয়েন্টমেন্ট নেব কীভাবে?`,
        en: `How do I book an appointment with a ${name} doctor?`,
      },
      answer: {
        bn: `পছন্দের ডাক্তারের প্রোফাইলে গিয়ে "অ্যাপয়েন্টমেন্ট নিন" বাটনে চাপুন, চেম্বার ও সময় বেছে নিন, তারপর নাম ও মোবাইল নম্বর দিন। চেম্বারের নম্বরে সরাসরি কল করেও সময় নেওয়া যায়।`,
        en: `Open the doctor's profile, tap "Book Appointment", choose the chamber and time, then enter your name and mobile number. Calling the chamber directly also works.`,
      },
    },
    beforeVisitSeed({ bn: `${name} ডাক্তার`, en: `a ${name} doctor` }),
    EMERGENCY_SEED,
  );

  return seeds;
}

// ---------------------------------------------------------------------------
// Hospital
//
// The only generator with no doctor-count gate, matching the sitemap: a
// hospital page carries its own address, departments and contact details and
// stays indexable even before a doctor is listed there.
// ---------------------------------------------------------------------------
export function hospitalFaqSeeds(ctx: {
  name: string;
  area: string;
  district: string;
  doctorCount: number;
  departments: string[];
}): FaqSeed[] {
  const { name } = ctx;
  const place = [ctx.area, ctx.district].filter(Boolean).join(", ");
  const seeds: FaqSeed[] = [];

  if (place) {
    seeds.push({
      key: "where",
      question: { bn: `${name} কোথায় অবস্থিত?`, en: `Where is ${name} located?` },
      answer: {
        bn: `${name} ${place} এলাকায় অবস্থিত। বিস্তারিত ঠিকানা, মানচিত্র ও যোগাযোগের নম্বর এই পেজেই দেওয়া আছে।`,
        en: `${name} is in ${place}. The full address, map and contact number are on this page.`,
      },
    });
  }

  if (ctx.doctorCount > 0) {
    const c = n(ctx.doctorCount);
    seeds.push({
      key: "doctors",
      question: {
        bn: `${name}-এ কোন কোন ডাক্তার বসেন?`,
        en: `Which doctors sit at ${name}?`,
      },
      answer: {
        bn: `এখানে ${c.bn} জন ডাক্তারের তথ্য আছে। প্রতিটি প্রোফাইলে বিশেষজ্ঞ বিভাগ, বসার সময় ও ভিজিট ফি দেওয়া আছে, তাই যাওয়ার আগেই সময় দেখে নিতে পারেন।`,
        en: `${c.en} doctors are listed here. Each profile shows the specialty, sitting hours and visit fee, so you can check the timing before you go.`,
      },
    });
  }

  if (ctx.departments.length > 0) {
    seeds.push({
      key: "departments",
      question: {
        bn: `${name}-এ কোন কোন বিভাগ আছে?`,
        en: `Which departments does ${name} have?`,
      },
      answer: {
        bn: `${list(ctx.departments, "bn", 8)} সহ বিভিন্ন বিভাগ রয়েছে। পুরো তালিকা এই পেজেই দেওয়া আছে।`,
        en: `${list(ctx.departments, "en", 8)}, among others. The full list is on this page.`,
      },
    });
  }

  seeds.push(
    {
      key: "find_doctor",
      question: {
        bn: `${name}-এ কোন ডাক্তার দেখাব কীভাবে ঠিক করব?`,
        en: `How do I decide which doctor to see at ${name}?`,
      },
      answer: {
        bn: `এই পেজের ডাক্তারদের তালিকায় প্রত্যেকের বিশেষজ্ঞ বিভাগ, ডিগ্রি, অভিজ্ঞতা ও ভিজিট ফি দেওয়া আছে। আপনার সমস্যার সাথে মেলে এমন বিভাগ বেছে নিন, তারপর সময়সূচি দেখে সুবিধামতো ডাক্তার ঠিক করুন।`,
        en: `The doctor list on this page shows each one's specialty, degrees, experience and visit fee. Pick the specialty that matches your problem, then choose by the schedule that suits you.`,
      },
    },
    {
      key: "appointment",
      question: {
        bn: `${name}-এ অ্যাপয়েন্টমেন্ট নেব কীভাবে?`,
        en: `How do I book an appointment at ${name}?`,
      },
      answer: {
        bn: `এই পেজের ডাক্তারদের তালিকা থেকে পছন্দের ডাক্তার বেছে নিয়ে "অ্যাপয়েন্টমেন্ট নিন" বাটনে চাপুন। হাসপাতালের নম্বরে সরাসরি কল করেও সময় নেওয়া যায়।`,
        en: `Pick a doctor from the list on this page and tap "Book Appointment". You can also call the hospital number directly.`,
      },
    },
    // Unconditional, so a hospital with no thana, no doctors and no
    // departments on file still clears the five-FAQ floor.
    beforeVisitSeed({ bn: name, en: name }),
    verifiedSeed({ bn: name, en: name }),
    EMERGENCY_SEED,
  );

  return seeds;
}

// ---------------------------------------------------------------------------
// Doctor
//
// Deliberately the shortest set. A profile page already states the degrees,
// chambers, schedule and fee in structured form, so these answer the questions
// people type rather than repeating the table above them. Nothing here makes a
// clinical claim, and no answer assumes the doctor's gender.
// ---------------------------------------------------------------------------
export function doctorFaqSeeds(ctx: {
  name: string;
  specialty: string;
  district: string;
  chamberNames: string[];
  hasSchedule: boolean;
  fee: number | null;
}): FaqSeed[] {
  const { name, specialty } = ctx;
  const seeds: FaqSeed[] = [];

  if (ctx.chamberNames.length > 0) {
    seeds.push({
      key: "chamber",
      question: { bn: `${name} কোথায় রোগী দেখেন?`, en: `Where does ${name} see patients?` },
      answer: {
        bn: `${list(ctx.chamberNames, "bn", 4)}${ctx.district ? `, ${ctx.district}` : ""} এ রোগী দেখেন। প্রতিটি চেম্বারের সম্পূর্ণ ঠিকানা ও মানচিত্র এই পেজেই দেওয়া আছে।`,
        en: `At ${list(ctx.chamberNames, "en", 4)}${ctx.district ? `, ${ctx.district}` : ""}. The full address and map for each chamber are on this page.`,
      },
    });
  }

  if (ctx.hasSchedule) {
    seeds.push({
      key: "schedule",
      question: { bn: `${name} কোন কোন দিন বসেন?`, en: `Which days does ${name} sit?` },
      answer: {
        bn: `চেম্বারভিত্তিক দিন ও সময়ের তালিকা এই পেজের "চেম্বার ও সময়সূচি" অংশে দেওয়া আছে। সময় মাঝে মাঝে বদলাতে পারে, তাই যাওয়ার আগে একবার চেম্বারে ফোন করে নিশ্চিত হয়ে নেওয়া ভালো।`,
        en: `The days and times for each chamber are listed in the "Chambers and Schedule" section on this page. Timings can change, so it is worth calling the chamber to confirm before you travel.`,
      },
    });
  }

  if (ctx.fee != null && ctx.fee > 0) {
    const f = n(ctx.fee);
    seeds.push({
      key: "fee",
      question: { bn: `${name} এর ভিজিট ফি কত?`, en: `What is ${name}'s visit fee?` },
      answer: {
        bn: `বর্তমান ভিজিট ফি ${f.bn} টাকা। একাধিক চেম্বার থাকলে ফি আলাদা হতে পারে, প্রতিটি চেম্বারের ফি উপরে দেওয়া আছে।`,
        en: `The current visit fee is ${f.en} taka. It can differ between chambers, and each chamber's fee is listed above.`,
      },
    });
  }

  if (specialty) {
    seeds.push({
      key: "specialty",
      question: {
        bn: `${name} কোন বিষয়ের বিশেষজ্ঞ?`,
        en: `What is ${name} a specialist in?`,
      },
      answer: {
        bn: `${name} ${withSpecialistSuffix(specialty)}। ডিগ্রি ও অভিজ্ঞতার বিস্তারিত এই পেজের উপরের অংশে দেওয়া আছে।`,
        en: `${name} is a ${specialty} specialist. Degrees and experience are shown at the top of this page.`,
      },
    });
  }

  // The five below are unconditional, so even a profile with no chamber,
  // schedule, fee or specialty on file still reaches the five-FAQ floor.
  const subject: MLPair = { bn: name, en: name };
  seeds.push(
    {
      key: "appointment",
      question: {
        bn: `${name} এর অ্যাপয়েন্টমেন্ট নেব কীভাবে?`,
        en: `How do I book an appointment with ${name}?`,
      },
      answer: {
        bn: `উপরের "অ্যাপয়েন্টমেন্ট নিন" বাটনে চাপুন, চেম্বার ও সময় বেছে নিন, তারপর নাম ও মোবাইল নম্বর দিন। চেম্বারের নম্বরে সরাসরি কল করেও সময় নেওয়া যায়।`,
        en: `Tap "Book Appointment" above, choose the chamber and time, then enter your name and mobile number. You can also call the chamber number directly.`,
      },
    },
    beforeVisitSeed(subject),
    contactSeed(subject),
    verifiedSeed(subject),
    EMERGENCY_SEED,
  );

  return seeds;
}
