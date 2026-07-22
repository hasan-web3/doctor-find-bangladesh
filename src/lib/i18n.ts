// i18n core: locale types, JSONB field localization, URL helpers.
// Bangla is the default locale served at root URLs; English lives under /en.

export const LOCALES = ["bn", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "bn";
export const LOCALE_COOKIE = "NEXT_LOCALE";

// A multilingual DB value stored as JSONB: {"bn": "...", "en": "..."}
export type MLText = { bn?: string | null; en?: string | null } | null | undefined;

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "bn" || value === "en";
}

// Localize a JSONB field with graceful fallback to Bangla (the required language).
export function t(field: MLText, locale: Locale): string {
  if (!field) return "";
  const preferred = field[locale];
  if (preferred && preferred.trim() !== "") return preferred;
  return field.bn || field.en || "";
}

// Build a locale-aware href: bn has no prefix, en is prefixed.
export function localeHref(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return locale === "en" ? `/en${clean === "/" ? "" : clean}` || "/en" : clean;
}

// Strip a locale prefix from a pathname, returning [locale, cleanPath].
export function splitLocalePath(pathname: string): [Locale, string] {
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const rest = pathname.slice(3) || "/";
    return ["en", rest];
  }
  return ["bn", pathname || "/"];
}

// Format helper: Bangla numerals only for bn locale.
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export function num(n: number | string, locale: Locale): string {
  const s = typeof n === "number" ? n.toLocaleString("en-IN") : String(n);
  return locale === "bn" ? s.replace(/[0-9]/g, (d) => BN_DIGITS[+d]) : s;
}

export function money(n: number, locale: Locale): string {
  return `৳ ${num(n, locale)}`;
}

const BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function date(d: Date | string, locale: Locale): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const months = locale === "bn" ? BN_MONTHS : EN_MONTHS;
  return locale === "bn"
    ? `${num(dt.getDate(), locale)} ${months[dt.getMonth()]}, ${num(dt.getFullYear(), locale)}`
    : `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

// OpenGraph/HTML lang tags
export function htmlLang(locale: Locale): string {
  return locale === "bn" ? "bn" : "en";
}
export function ogLocale(locale: Locale): string {
  return locale === "bn" ? "bn_BD" : "en_US";
}
