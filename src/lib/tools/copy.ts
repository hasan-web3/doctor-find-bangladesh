// ---------------------------------------------------------------------------
// Bilingual UI strings for the /tools section.
// ---------------------------------------------------------------------------
// Kept out of src/lib/dict.ts on purpose. That file is the site-wide dictionary
// loaded into every page's bundle through the layout; this is ~90 strings used
// by exactly two routes. Only `nav_tools` lives in dict.ts, because the navbar
// needs it everywhere.
//
// Same shape as dict.ts so it reads the same way: two objects with identical
// keys, `en` typed against `bn` so a missing translation is a build error
// rather than a Bangla string leaking onto an English page.
// ---------------------------------------------------------------------------

import type { Locale } from "../i18n";

const bn = {
  // ---- index page ----
  index_title: "স্বাস্থ্য টুলস",
  index_heading: "স্বাস্থ্য বিষয়ক ক্যালকুলেটর",
  index_sub: "বিএমআই, ক্যালরি, প্রেগন্যান্সি ডিউ ডেট সহ কিছু সহজ হিসাব। কোনো পরীক্ষা লাগে না, শুধু কয়েকটি তথ্য দিলেই ফলাফল।",
  index_search_placeholder: "টুল খুঁজুন, যেমন বিএমআই",
  index_search_label: "টুল খুঁজুন",
  index_empty: "এই নামে কোনো টুল পাওয়া যায়নি।",
  index_empty_hint: "অন্য শব্দ দিয়ে খুঁজে দেখুন।",
  index_count_one: "টি টুল",
  index_planned_title: "শীঘ্রই আসছে",
  index_planned_sub: "এই টুলগুলো তৈরির কাজ চলছে।",
  index_open: "খুলুন",

  // ---- categories ----
  cat_body: "শরীর ও ফিটনেস",
  cat_maternity: "মা ও গর্ভাবস্থা",
  cat_child: "শিশু",
  cat_lifestyle: "জীবনযাপন",

  // ---- shared tool shell ----
  tool_guide_title: "এই টুলটি কী কাজে লাগে",
  tool_calculate: "হিসাব করুন",
  tool_reset: "আবার শুরু",
  tool_result_title: "আপনার ফলাফল",
  tool_source_title: "হিসাবের ভিত্তি",
  tool_privacy_note: "আপনার দেওয়া তথ্য শুধু আপনার ব্রাউজারেই হিসাব হয়। কিছুই সংরক্ষণ করা হয় না, কোথাও পাঠানো হয় না।",
  tool_disclaimer_title: "মনে রাখবেন",
  tool_disclaimer:
    "এই টুলটি শুধু ধারণা দেওয়ার জন্য, এটি কোনো রোগ নির্ণয় করে না এবং ডাক্তারের পরামর্শের বিকল্প নয়। শারীরিক কোনো সমস্যা বা দুশ্চিন্তা থাকলে একজন রেজিস্টার্ড ডাক্তারের সাথে কথা বলুন।",
  tool_related_doctors: "সংশ্লিষ্ট বিশেষজ্ঞ ডাক্তার",
  tool_related_doctors_sub: "ফলাফল নিয়ে কথা বলতে চাইলে এই বিভাগের ডাক্তার দেখুন।",
  tool_other_tools: "অন্যান্য টুল",
  tool_all_tools: "সব টুল দেখুন",
  tool_faq_title: "সাধারণ জিজ্ঞাসা",
  tool_fill_prompt: "উপরের তথ্যগুলো দিন, ফলাফল এখানে দেখা যাবে।",
  tool_invalid: "দেওয়া তথ্যগুলো একবার দেখে নিন, কোনো একটি ঠিক মনে হচ্ছে না।",

  // ---- units & common fields ----
  unit_cm: "সেন্টিমিটার",
  unit_m: "মিটার",
  unit_ftin: "ফুট / ইঞ্চি",
  unit_kg: "কেজি",
  unit_lb: "পাউন্ড",
  unit_ft_short: "ফুট",
  unit_in_short: "ইঞ্চি",
  field_height: "উচ্চতা",
  field_weight: "ওজন",
  field_age: "বয়স",
  field_age_unit: "বছর",
  field_age_optional: "বয়স (ঐচ্ছিক)",
  field_sex: "লিঙ্গ",
  sex_male: "পুরুষ",
  sex_female: "নারী",
  sex_note: "ক্যালরির হিসাবে শরীরের গড় গঠনের পার্থক্যের জন্য এটি দরকার হয়।",

  // ---- BMI ----
  bmi_result_label: "আপনার বিএমআই",
  bmi_scale_asian: "এশীয় মান (দক্ষিণ এশিয়ার জন্য প্রযোজ্য)",
  bmi_scale_intl: "আন্তর্জাতিক মান",
  bmi_healthy_range: "আপনার উচ্চতায় স্বাস্থ্যকর ওজন",
  bmi_delta_over: "স্বাস্থ্যকর সীমার চেয়ে বেশি",
  bmi_delta_under: "স্বাস্থ্যকর সীমায় পৌঁছাতে দরকার",
  bmi_delta_in: "আপনার ওজন স্বাস্থ্যকর সীমার মধ্যেই আছে",
  bmi_why_two_scales:
    "দক্ষিণ এশিয়ার মানুষের শরীরে একই বিএমআই-তে চর্বির পরিমাণ বেশি থাকে, তাই কম বিএমআই থেকেই ডায়াবেটিস ও হৃদরোগের ঝুঁকি শুরু হয়। এজন্য WHO আলাদা করে এশীয় সীমা দিয়েছে, আর এখানে দুটোই দেখানো হয়েছে।",
  bmi_age_hint: "বয়স দিলে ফলাফলটি আরও সঠিকভাবে ব্যাখ্যা করা যায়।",

  // ---- calories ----
  cal_field_activity: "দৈনিক পরিশ্রম",
  cal_field_goal: "আপনার লক্ষ্য",
  goal_lose: "ওজন কমানো",
  goal_maintain: "ওজন ধরে রাখা",
  goal_gain: "ওজন বাড়ানো",
  cal_target_label: "দিনে খাওয়ার লক্ষ্য",
  cal_unit: "ক্যালরি",
  cal_unit_short: "kcal",
  cal_per_day: "প্রতিদিন",
  cal_bmr_label: "বিশ্রামে পোড়ে (BMR)",
  cal_bmr_hint: "কিছু না করলেও শরীর যতটুকু ক্যালরি খরচ করে।",
  cal_tdee_label: "সারাদিনে পোড়ে (TDEE)",
  cal_tdee_hint: "কাজকর্ম ও ব্যায়াম মিলিয়ে দিনের মোট খরচ।",
  cal_macro_title: "পুষ্টির ভাগ",
  cal_macro_hint: "এটি একটি সাধারণ ভাগ। ডায়াবেটিস, কিডনি বা অন্য কোনো রোগ থাকলে অনুপাত আলাদা হবে, ডাক্তার বা পুষ্টিবিদের পরামর্শ নিন।",
  macro_protein: "প্রোটিন",
  macro_carbs: "শর্করা",
  macro_fat: "চর্বি",
  macro_gram: "গ্রাম",
  cal_compare_title: "লক্ষ্য অনুযায়ী তুলনা",

  // ---- due date ----
  dd_field_lmp: "শেষ মাসিকের প্রথম দিন",
  dd_field_lmp_hint: "শেষবার মাসিক শুরু হওয়ার তারিখ, শেষ হওয়ার নয়।",
  dd_field_cycle: "মাসিক চক্রের দৈর্ঘ্য",
  dd_field_cycle_unit: "দিন",
  dd_field_cycle_hint: "সাধারণত ২৮ দিন। জানা না থাকলে ২৮ রেখে দিন।",
  dd_edd_label: "সম্ভাব্য প্রসবের তারিখ",
  dd_current_label: "এখন চলছে",
  dd_weeks: "সপ্তাহ",
  dd_days: "দিন",
  dd_remaining: "বাকি আছে",
  dd_remaining_days: "দিন",
  dd_conception_label: "সম্ভাব্য গর্ভধারণের সময়",
  dd_trimester_label: "ত্রৈমাসিক",
  dd_trimester_1: "প্রথম",
  dd_trimester_2: "দ্বিতীয়",
  dd_trimester_3: "তৃতীয়",
  dd_progress_label: "গর্ভাবস্থার অগ্রগতি",
  dd_anc_title: "চেকআপের সময়সূচি",
  dd_anc_sub:
    "বিশ্ব স্বাস্থ্য সংস্থা গর্ভাবস্থায় অন্তত ৮ বার চেকআপের পরামর্শ দেয়। বাংলাদেশের জাতীয় নির্দেশিকায় সর্বনিম্ন ৪ বার বলা আছে, তবে বেশি বার দেখানো সবসময়ই ভালো।",
  dd_anc_done: "সময় পেরিয়েছে",
  dd_anc_next: "পরবর্তী",
  dd_anc_upcoming: "সামনে",
  dd_error_future: "তারিখটি ভবিষ্যতের। শেষ মাসিক শুরু হওয়ার তারিখটি দিন।",
  dd_error_too_old: "তারিখটি অনেক আগের। শেষ মাসিকের তারিখ ঠিক আছে কিনা দেখে নিন।",
  dd_error_invalid: "তারিখটি ঠিকভাবে দিন।",
  dd_overdue_note:
    "হিসাব অনুযায়ী ৪২ সপ্তাহ পার হয়ে গেছে। এই পর্যায়ে দেরি না করে দ্রুত ডাক্তারের সাথে যোগাযোগ করুন।",
  dd_warning_title: "যেসব লক্ষণে দেরি করবেন না",
  dd_warning_body:
    "তীব্র মাথাব্যথা, চোখে ঝাপসা দেখা, হাত-মুখ হঠাৎ ফুলে যাওয়া, তীব্র পেটব্যথা, রক্তপাত, জ্বর, অথবা শিশুর নড়াচড়া কমে গেলে সাথে সাথে হাসপাতালে যান।",

  // ---- share card ----
  share_save: "ছবি হিসেবে সংরক্ষণ করুন",
  share_busy: "তৈরি হচ্ছে...",
  share_done: "হয়ে গেছে",
  share_error: "সংরক্ষণ করা যায়নি, আবার চেষ্টা করুন",
  share_hint: "ছবিটি ফোনে সেভ করে রাখতে বা পরিবারের সাথে শেয়ার করতে পারেন।",
  // Deliberately shorter and blunter than the on-page disclaimer: it is
  // rendered into the image itself, where there is no room to be gentle and no
  // surrounding page to supply the context.
  dd_card_disclaimer:
    "এটি একটি আনুমানিক হিসাব, নিশ্চিত তারিখ নয়। প্রায় ২০ জনের মধ্যে ১ জনের সন্তান ঠিক এই দিনে জন্মায়। এটি কোনো রোগ নির্ণয় নয়, নিয়মিত ডাক্তারের পরামর্শ নিন।",
} as const;

const en: Record<keyof typeof bn, string> = {
  index_title: "Health Tools",
  index_heading: "Health calculators",
  index_sub: "Simple calculations like BMI, daily calories and pregnancy due date. No test needed, just a few details and you get a result.",
  index_search_placeholder: "Search tools, e.g. BMI",
  index_search_label: "Search tools",
  index_empty: "No tool matches that name.",
  index_empty_hint: "Try a different word.",
  index_count_one: "tools",
  index_planned_title: "Coming soon",
  index_planned_sub: "These tools are being built.",
  index_open: "Open",

  cat_body: "Body & fitness",
  cat_maternity: "Pregnancy & motherhood",
  cat_child: "Children",
  cat_lifestyle: "Lifestyle",

  tool_guide_title: "What this tool is for",
  tool_calculate: "Calculate",
  tool_reset: "Start over",
  tool_result_title: "Your result",
  tool_source_title: "What this is based on",
  tool_privacy_note: "Everything you enter is calculated in your own browser. Nothing is saved and nothing is sent anywhere.",
  tool_disclaimer_title: "Please note",
  tool_disclaimer:
    "This tool is for general information only. It does not diagnose anything and it is not a substitute for a doctor's advice. If something is wrong or worrying you, please speak to a registered doctor.",
  tool_related_doctors: "Related specialists",
  tool_related_doctors_sub: "If you want to talk your result through, these are the specialists to see.",
  tool_other_tools: "Other tools",
  tool_all_tools: "See all tools",
  tool_faq_title: "Common questions",
  tool_fill_prompt: "Fill in the details above and your result will appear here.",
  tool_invalid: "Please check the details above, one of them does not look right.",

  unit_cm: "Centimetres",
  unit_m: "Metres",
  unit_ftin: "Feet / inches",
  unit_kg: "Kilograms",
  unit_lb: "Pounds",
  unit_ft_short: "ft",
  unit_in_short: "in",
  field_height: "Height",
  field_weight: "Weight",
  field_age: "Age",
  field_age_unit: "years",
  field_age_optional: "Age (optional)",
  field_sex: "Sex",
  sex_male: "Male",
  sex_female: "Female",
  sex_note: "The calorie formula needs this because average body composition differs.",

  bmi_result_label: "Your BMI",
  bmi_scale_asian: "Asian cut-offs (the ones that apply in South Asia)",
  bmi_scale_intl: "International cut-offs",
  bmi_healthy_range: "Healthy weight for your height",
  bmi_delta_over: "above the healthy range",
  bmi_delta_under: "to reach the healthy range",
  bmi_delta_in: "Your weight is inside the healthy range",
  bmi_why_two_scales:
    "South Asians carry more body fat at the same BMI, so diabetes and heart risk begin at a lower number. That is why WHO published separate Asian cut-offs, and why both are shown here.",
  bmi_age_hint: "Adding your age lets the result be interpreted more carefully.",

  cal_field_activity: "Daily activity",
  cal_field_goal: "Your goal",
  goal_lose: "Lose weight",
  goal_maintain: "Maintain weight",
  goal_gain: "Gain weight",
  cal_target_label: "Daily intake target",
  cal_unit: "calories",
  cal_unit_short: "kcal",
  cal_per_day: "per day",
  cal_bmr_label: "Burned at rest (BMR)",
  cal_bmr_hint: "What your body uses doing nothing at all.",
  cal_tdee_label: "Burned in a day (TDEE)",
  cal_tdee_hint: "Your total daily burn including work and exercise.",
  cal_macro_title: "Nutrient split",
  cal_macro_hint: "This is a general split. With diabetes, kidney disease or any other condition the ratio changes, so ask a doctor or dietitian.",
  macro_protein: "Protein",
  macro_carbs: "Carbohydrate",
  macro_fat: "Fat",
  macro_gram: "g",
  cal_compare_title: "Compared across goals",

  dd_field_lmp: "First day of your last period",
  dd_field_lmp_hint: "The day your last period started, not the day it ended.",
  dd_field_cycle: "Cycle length",
  dd_field_cycle_unit: "days",
  dd_field_cycle_hint: "Usually 28 days. If you are not sure, leave it at 28.",
  dd_edd_label: "Estimated delivery date",
  dd_current_label: "You are at",
  dd_weeks: "weeks",
  dd_days: "days",
  dd_remaining: "remaining",
  dd_remaining_days: "days",
  dd_conception_label: "Estimated conception",
  dd_trimester_label: "trimester",
  dd_trimester_1: "First",
  dd_trimester_2: "Second",
  dd_trimester_3: "Third",
  dd_progress_label: "Pregnancy progress",
  dd_anc_title: "Checkup schedule",
  dd_anc_sub:
    "The World Health Organization recommends at least 8 antenatal contacts. Bangladesh's national guideline sets a minimum of 4, but more visits are always better.",
  dd_anc_done: "passed",
  dd_anc_next: "Next",
  dd_anc_upcoming: "Upcoming",
  dd_error_future: "That date is in the future. Please enter when your last period started.",
  dd_error_too_old: "That date is a long time ago. Please check the period date is right.",
  dd_error_invalid: "Please enter a valid date.",
  dd_overdue_note:
    "By this calculation you are past 42 weeks. Please contact a doctor without delay.",
  dd_warning_title: "Do not wait if you notice",
  dd_warning_body:
    "Severe headache, blurred vision, sudden swelling of the hands or face, severe abdominal pain, bleeding, fever, or reduced movement of the baby. Go to hospital straight away.",

  share_save: "Save as image",
  share_busy: "Preparing...",
  share_done: "Done",
  share_error: "Could not save, please try again",
  share_hint: "Save it to your phone or share it with your family.",
  dd_card_disclaimer:
    "This is an estimate, not a fixed date. About 1 baby in 20 arrives exactly on this day. It is not a diagnosis, so please keep seeing your doctor.",
};

export type ToolCopy = typeof bn;

export function getToolCopy(locale: Locale): ToolCopy {
  return (locale === "en" ? en : bn) as ToolCopy;
}

/** Pick the right half of a `{ bn, en }` pair from the registry or calc module. */
export function pick(text: { bn: string; en: string }, locale: Locale): string {
  return locale === "en" ? text.en || text.bn : text.bn || text.en;
}
