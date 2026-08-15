// BMDC registration helpers, shared by the admin list, the public badge and
// the JSON-LD builder.
//
// Deliberately dependency-free and not server-only: the admin table and the
// profile badge are client components, while ldPhysician() runs on the server,
// and all three have to agree on the same URL and the same idea of "expiring
// soon". A second copy of that rule is a second thing to get wrong.

/** The Council's own verification page. The only URL we ever point people at. */
export const BMDC_VERIFY_URL = "https://verify.bmdc.org.bd";

/**
 * How close to expiry a registration has to be before the admin list warns.
 *
 * Two months rather than a tighter window: the point is to catch a lapse
 * BEFORE the public profile is advertising a badge the register no longer
 * backs, and renewing takes time.
 */
export const BMDC_EXPIRY_WARNING_DAYS = 61;

export type BmdcExpiry = "none" | "ok" | "soon" | "expired";

// ---------------------------------------------------------------------------
// Month-precision validity
// ---------------------------------------------------------------------------
// BMDC's own register prints validity as a MONTH, not a day: "Reg. Valid Till
// 07/2029". So that is what the admin types, and what every screen shows.
//
// The COLUMN stays a real `date` regardless, holding the LAST day of that
// month. Two reasons:
//   1. "valid till 07/2029" means valid through the end of July, so the last
//      day is the honest instant of expiry. Storing the first day would retire
//      the badge a month early.
//   2. A date column keeps the expiry comparisons plain date arithmetic. As a
//      "YYYY-MM" string, "is it expiring within 61 days" stops being a
//      comparison and turns into month-boundary arithmetic at every call site.

/** "2029-07-31" -> "2029-07". Returns "" for null/empty. */
export function isoToMonth(iso: string | null): string {
  return iso ? iso.slice(0, 7) : "";
}

/**
 * "2029-07" -> "2029-07-31", the last day of that month.
 *
 * Day 0 of the FOLLOWING month is the last day of this one, which sidesteps
 * every leap-year and 30-vs-31 special case. Built in UTC so no timezone can
 * roll it back into the previous month.
 */
export function monthToIsoEnd(month: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12 || year < 1900 || year > 2200) return null;
  return new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10);
}

/** "2029-07-31" -> "07/2029", the way the BMDC register prints it. */
export function formatBmdcMonth(iso: string | null): string {
  const m = isoToMonth(iso);
  if (!m) return "";
  const [year, mon] = m.split("-");
  return `${mon}/${year}`;
}

/** Today as yyyy-mm-dd in the viewer's own timezone. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Calendar arithmetic in UTC, so a DST boundary cannot shift the result. */
export function isoAddDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Where a registration sits relative to today.
 *
 * Dates are compared as plain yyyy-mm-dd strings, which sort chronologically.
 * No Date is constructed for the comparison, so no timezone can move the
 * boundary by a day and turn a valid registration red.
 *
 * `today` is a parameter rather than being read inside, so that a table full of
 * rows judges every one of them against the same day even if the render
 * happens to straddle midnight.
 */
export function bmdcExpiry(validTill: string | null, today: string = todayIso()): BmdcExpiry {
  if (!validTill) return "none";
  if (validTill < today) return "expired";
  if (validTill <= isoAddDays(today, BMDC_EXPIRY_WARNING_DAYS)) return "soon";
  return "ok";
}
