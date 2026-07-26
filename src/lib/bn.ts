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
