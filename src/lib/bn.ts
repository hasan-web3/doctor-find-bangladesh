// Helpers for Bengali language grammar and conventions.

// Bengali possessive marker. The suffix depends on how the word ends:
//   • vowel sign  (া, ী, …)   → `র`      (খুলনা → খুলনার)
//   • chandrabindu ঁ           → `র`      (নওগাঁ → নওগাঁর — the ঁ sits on a
//                                          vowel, so phonetically vowel-ending)
//   • independent ও            → `য়ের`   (ঠাকুরগাঁও → ঠাকুরগাঁওয়ের —
//                                          sandhi inserts য় between ও + এ)
//   • consonant                → `ের`    (বাগেরহাট → বাগেরহাটের)
//
// Tested against all 64 Bangladesh districts.
export function withPossessive(word: string): string {
  if (!word) return "";

  const vowelSigns = ["া", "ি", "ী", "ু", "ূ", "ে", "ৈ", "ো", "ৌ"];
  const last = word.slice(-1);

  if (last === "ঁ") return `${word}র`;
  if (last === "ও") return `${word}য়ের`;
  if (vowelSigns.includes(last)) return `${word}র`;
  return `${word}ের`;
}

// Human-readable span between two ISO dates, in Bangla.
//
// Counted the way a sponsorship is sold: 8 March → 8 April reads as "১ মাস",
// not "৩১ দিন". So the walk is calendar-based (years, then months, then the
// leftover days) rather than a raw millisecond division, which would drift
// across months of different lengths and across leap years.
//
// Whole weeks get their own phrasing because that is how short packages are
// usually quoted — 14 days is "২ সপ্তাহ", but 15 days stays "১৫ দিন".
export function bnDuration(startIso: string, endIso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endIso)) return null;
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  if (end < start) return null;

  const totalDays = Math.round((end - start) / 86400000);
  // Same start and end still means the doctor is promoted that day.
  if (totalDays === 0) return "১ দিন";

  let years = ey - sy;
  let months = em - sm;
  let days = ed - sd;
  if (days < 0) {
    months -= 1;
    // Days in the month preceding the end date — day 0 of a month is the last
    // day of the previous one.
    days += new Date(Date.UTC(ey, em - 1, 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years === 0 && months === 0 && days % 7 === 0 && days >= 7) {
    return `${bnNum(days / 7)} সপ্তাহ`;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${bnNum(years)} বছর`);
  if (months > 0) parts.push(`${bnNum(months)} মাস`);
  if (days > 0) parts.push(`${bnNum(days)} দিন`);
  return parts.join(" ");
}

const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function bnNum(n: number | string): string {
  const s = String(n);
  let bn = "";
  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (char >= "0" && char <= "9") {
      bn += bnDigits[parseInt(char)];
    } else {
      bn += char;
    }
  }
  return bn;
}

export function bnDate(dateStr: string | Date): string {
  try {
    const date = new Date(dateStr);
    const day = bnNum(date.getDate());
    const year = bnNum(date.getFullYear());
    const month = new Intl.DateTimeFormat("bn-BD-u-nu-beng", { month: "long" }).format(date);
    return `${day} ${month}, ${year}`;
  } catch (e) {
    return dateStr.toString();
  }
}

export function bnMoney(amount: number | string): string {
  const num = Number(amount);
  if (isNaN(num)) return bnNum(String(amount));

  return new Intl.NumberFormat("bn-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num).replace('BDT', '৳');
}

export function bnDateTime(dateStr: string | Date): string {
  try {
    const date = new Date(dateStr);
    const formattedDate = new Intl.DateTimeFormat("bn-BD-u-nu-beng", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);

    const formattedTime = new Intl.DateTimeFormat("bn-BD-u-nu-beng", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }).format(date);

    return `${formattedDate}, ${formattedTime}`;
  } catch (e) {
    return String(dateStr);
  }
}

/**
 * "<specialty> বিশেষজ্ঞ", without saying it twice.
 *
 * Most specialty names are a bare subject ("কিডনি", "চর্ম ও যৌন") and read
 * correctly with "বিশেষজ্ঞ" appended. A few already carry the word or a synonym
 * in the name itself, and appending blindly produced headings like
 * "খুলনার সেরা শিশু বিশেষজ্ঞ বিশেষজ্ঞ ডাক্তার".
 *
 * Affects only the Bangla copy; English names never carry "Specialist".
 */
export function withSpecialistSuffix(name: string): string {
  return /বিশেষজ্ঞ|স্পেশালিষ্ট|স্পেশালিস্ট/.test(name) ? name : `${name} বিশেষজ্ঞ`;
}
