"use client";

import { useMemo } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";

// A schedule "entry" in the DB is a { days: ML, time: ML } pair — pre-formatted
// strings that render straight onto the chamber card. This picker keeps the
// same storage shape but drives it from a structured local model: for each
// weekday the admin picks time ranges, and the picker synthesizes the Bangla +
// English strings on the fly. Legacy chambers with free-text entries still
// load and save unchanged.

export type ML = { bn: string; en: string };
export type ScheduleEntry = { days: ML; time: ML };

type Range = { start: string; end: string }; // "HH:MM" 24h

const DAY_ORDER = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
export type DayKey = (typeof DAY_ORDER)[number];

// Bangla weekday names — used to build both the header chip and the emitted string.
const DAY_LABELS: Record<DayKey, { bn: string; bn_short: string; en: string; en_short: string; bn_alt?: string[] }> = {
  sat: { bn: "শনিবার",     bn_short: "শনি",   en: "Saturday",  en_short: "Sat", bn_alt: ["শনি"] },
  sun: { bn: "রবিবার",     bn_short: "রবি",   en: "Sunday",    en_short: "Sun", bn_alt: ["রবি"] },
  mon: { bn: "সোমবার",     bn_short: "সোম",   en: "Monday",    en_short: "Mon", bn_alt: ["সোম"] },
  tue: { bn: "মঙ্গলবার",   bn_short: "মঙ্গল", en: "Tuesday",   en_short: "Tue", bn_alt: ["মঙ্গল", "মোঙ্গল"] },
  wed: { bn: "বুধবার",     bn_short: "বুধ",   en: "Wednesday", en_short: "Wed", bn_alt: ["বুধ"] },
  thu: { bn: "বৃহস্পতিবার", bn_short: "বৃহঃ",  en: "Thursday",  en_short: "Thu", bn_alt: ["বৃহস্পতি", "বৃহঃ", "বৃহ"] },
  fri: { bn: "শুক্রবার",   bn_short: "শুক্র", en: "Friday",    en_short: "Fri", bn_alt: ["শুক্র"] },
};

// ---------- time helpers ----------

const bnDigits = "০১২৩৪৫৬৭৮৯";
const bnNum = (n: number) => String(n).split("").map((d) => bnDigits[Number(d)]).join("");

function formatEn(hhmm: string): string {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${displayHour} ${period}` : `${displayHour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatBn(hhmm: string): string {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  const period =
    h < 4 ? "রাত" : h < 5 ? "ভোর" : h < 12 ? "সকাল" :
    h < 15 ? "দুপুর" : h < 18 ? "বিকেল" : h < 20 ? "সন্ধ্যা" : "রাত";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0
    ? `${period} ${bnNum(displayHour)}টা`
    : `${period} ${bnNum(displayHour)}:${bnNum(Number(String(m).padStart(2, "0")))}`;
}

function rangeToStrings(r: Range): { bn: string; en: string } {
  return { bn: `${formatBn(r.start)} - ${formatBn(r.end)}`, en: `${formatEn(r.start)} - ${formatEn(r.end)}` };
}

// Minutes since midnight — makes overlap math trivial.
const toMinutes = (hhmm: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

function overlaps(a: Range, b: Range): boolean {
  const a1 = toMinutes(a.start), a2 = toMinutes(a.end);
  const b1 = toMinutes(b.start), b2 = toMinutes(b.end);
  if (!Number.isFinite(a1 + a2 + b1 + b2)) return false;
  return a1 < b2 && b1 < a2;
}

// ---------- parsing legacy free-text ----------

// Match one bn/en token to a DayKey. Handles short, long, and alt spellings
// ("শনি" → sat, "Sat" → sat, "মোঙ্গল" typo → tue).
function tokenToDay(token: string): DayKey | null {
  const t = token.trim();
  if (!t) return null;
  for (const k of DAY_ORDER) {
    const lb = DAY_LABELS[k];
    if (t === lb.bn || t === lb.bn_short || t === lb.en || t === lb.en_short) return k;
    if (lb.bn_alt?.some((a) => t === a)) return k;
    // Loose contains for legacy "শনি, রবি, সোম" style — split beforehand, so
    // by this point each token is a single day name.
  }
  return null;
}

// Split a "days" string that may list multiple days: "শনি, রবি, সোম" or
// "Sat, Sun, Mon" or "শনি/রবি" — returns every day key it can identify.
function splitDayTokens(raw: string): DayKey[] {
  return raw
    .split(/[,،/।\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(tokenToDay)
    .filter((d): d is DayKey => !!d);
}

// Parse a segment like "6 PM - 9 PM" / "সন্ধ্যা ৬টা থেকে রাত ৯টা".
function parseTimeRange(seg: string): Range | null {
  // Try English first: "6 PM - 9 PM", "6:30 AM - 9:00 PM"
  const en = seg.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)\s*[-–—to]+\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)/);
  const toHHMM = (h: number, min: number, p: string | undefined) => {
    let hh = h;
    if (p) {
      const up = p.toUpperCase();
      if (up === "PM" && hh < 12) hh += 12;
      if (up === "AM" && hh === 12) hh = 0;
    }
    if (hh < 0 || hh > 23) return null;
    return `${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  };
  if (en) {
    const s = toHHMM(Number(en[1]), Number(en[2] || 0), en[3]);
    const e = toHHMM(Number(en[4]), Number(en[5] || 0), en[6]);
    if (s && e) return { start: s, end: e };
  }
  // 24-hour: "18:00 - 21:00"
  const raw = seg.match(/(\d{1,2}):(\d{2})\s*[-–—]+\s*(\d{1,2}):(\d{2})/);
  if (raw) {
    return { start: `${raw[1].padStart(2, "0")}:${raw[2]}`, end: `${raw[3].padStart(2, "0")}:${raw[4]}` };
  }
  return null;
}

// Parse a whole entry — supports multi-day lists in `days` and comma-separated
// range list in `time`. Returns a list of (day, ranges) tuples so legacy rows
// like "শনি, রবি, সোম → সন্ধ্যা ৬টা থেকে রাত ৯টা" cleanly expand into three
// chips, each carrying the same range.
function parseEntry(entry: ScheduleEntry): Array<{ day: DayKey; ranges: Range[] }> {
  const daysRaw = (entry.days.en?.trim() || entry.days.bn?.trim() || "").trim();
  const timeRaw = (entry.time.en?.trim() || entry.time.bn?.trim() || "").trim();
  const days = splitDayTokens(daysRaw);
  const ranges = timeRaw
    .split(/,|;|·/)
    .map((s) => parseTimeRange(s.trim()))
    .filter((r): r is Range => !!r);
  if (days.length === 0 || ranges.length === 0) return [];
  return days.map((d) => ({ day: d, ranges }));
}

// ---------- component ----------

/**
 * ScheduleDayPicker
 * -----------------
 * Structured day + time-range editor. Weekday chips toggle rows; each row
 * accepts multiple (start, end) ranges. `bookedElsewhere` shows time ranges
 * already claimed by other chambers for this doctor — the picker warns on
 * conflict so the same doctor can't hold two chambers at the same slot.
 */
export function ScheduleDayPicker({
  value,
  onChange,
  bookedElsewhere,
}: {
  value: ScheduleEntry[];
  onChange: (v: ScheduleEntry[]) => void;
  bookedElsewhere?: Partial<Record<DayKey, Range[]>>;
}) {
  const [chipsRef] = useAutoAnimate<HTMLDivElement>();
  const [rowsRef] = useAutoAnimate<HTMLDivElement>();

  // Rebuild the structured model from `value` on every render — controlled.
  const byDay = useMemo(() => {
    const m = new Map<DayKey, Range[]>();
    for (const entry of value) {
      const parsed = parseEntry(entry);
      // parseEntry returns [] for anything we can't identify. Those rows are
      // silently dropped from the picker's view — they're already lost data
      // (couldn't be recognised as day+time) and we don't want them replaying
      // as ghost rows underneath. Nothing here is destructive: the picker
      // rebuilds `value` from scratch on every change.
      for (const p of parsed) {
        m.set(p.day, [...(m.get(p.day) ?? []), ...p.ranges]);
      }
    }
    // Deduplicate ranges within a day.
    for (const [k, rs] of m) {
      const seen = new Set<string>();
      const uniq = rs.filter((r) => {
        const key = `${r.start}-${r.end}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      m.set(k, uniq);
    }
    return m;
  }, [value]);

  const emit = (next: Map<DayKey, Range[]>) => {
    const rows: ScheduleEntry[] = [];
    for (const day of DAY_ORDER) {
      const rs = next.get(day);
      if (!rs || rs.length === 0) continue;
      const parts = rs.map(rangeToStrings);
      rows.push({
        days: { bn: DAY_LABELS[day].bn, en: DAY_LABELS[day].en },
        time: {
          bn: parts.map((p) => p.bn).join(", "),
          en: parts.map((p) => p.en).join(", "),
        },
      });
    }
    onChange(rows);
  };

  const toggleDay = (day: DayKey) => {
    const copy = new Map(byDay);
    if (copy.has(day)) copy.delete(day);
    else copy.set(day, [{ start: "18:00", end: "21:00" }]);
    emit(copy);
  };

  const setRange = (day: DayKey, idx: number, patch: Partial<Range>) => {
    const copy = new Map(byDay);
    const rs = [...(copy.get(day) ?? [])];
    rs[idx] = { ...rs[idx], ...patch };
    copy.set(day, rs);
    emit(copy);
  };

  const addRange = (day: DayKey) => {
    const copy = new Map(byDay);
    const rs = [...(copy.get(day) ?? [])];
    const last = rs[rs.length - 1];
    const start = last?.end || "08:00";
    const end = last ? "19:00" : "12:00";
    rs.push({ start, end });
    copy.set(day, rs);
    emit(copy);
  };

  const removeRange = (day: DayKey, idx: number) => {
    const copy = new Map(byDay);
    const rs = [...(copy.get(day) ?? [])];
    rs.splice(idx, 1);
    if (rs.length === 0) copy.delete(day);
    else copy.set(day, rs);
    emit(copy);
  };

  // For a given day + range, find the first conflicting range across:
  // (a) ranges from other chambers, (b) ranges from THIS chamber on the same day.
  const conflictOf = (day: DayKey, idx: number, r: Range): { source: "same" | "other"; other: Range } | null => {
    const otherChambers = (bookedElsewhere?.[day] ?? []).filter((b) => overlaps(r, b));
    if (otherChambers.length > 0) return { source: "other", other: otherChambers[0] };
    const sameDay = (byDay.get(day) ?? []).filter((b, i) => i !== idx && overlaps(r, b));
    if (sameDay.length > 0) return { source: "same", other: sameDay[0] };
    return null;
  };

  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <div ref={chipsRef} className="mb-3 flex flex-wrap gap-1.5">
        {DAY_ORDER.map((d) => {
          const on = byDay.has(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={
                on
                  ? "rounded-full bg-brand-600 px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors"
                  : "rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-semibold text-ink-mute transition-colors hover:border-brand-300"
              }
            >
              {DAY_LABELS[d].bn_short} · {DAY_LABELS[d].en_short}
            </button>
          );
        })}
      </div>

      <div ref={rowsRef}>
        {[...byDay.entries()]
          .sort(([a], [b]) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
          .map(([day, ranges]) => {
            const booked = bookedElsewhere?.[day] ?? [];
            return (
              <div key={day} className="mb-2.5 rounded-lg border border-line/70 bg-page p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[13px] font-bold text-ink-soft">
                    {DAY_LABELS[day].bn} · {DAY_LABELS[day].en}
                  </div>
                  <button
                    type="button"
                    onClick={() => addRange(day)}
                    className="text-[12px] font-semibold text-brand-600"
                  >
                    + সময় যোগ করুন
                  </button>
                </div>

                {booked.length > 0 && (
                  <div className="mb-2 rounded-md bg-warm-soft px-2.5 py-1.5 text-[11.5px] text-warm-heavy">
                    অন্য চেম্বারে ইতিমধ্যে বুক করা:
                    {" "}
                    {booked.map((r, i) => (
                      <span key={i} className="font-semibold">
                        {i > 0 && ", "}
                        {formatBn(r.start)} - {formatBn(r.end)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {ranges.map((r, i) => {
                    const conflict = conflictOf(day, i, r);
                    return (
                      <div key={i}>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={r.start}
                            onChange={(e) => setRange(day, i, { start: e.target.value })}
                            className={
                              "rounded-md border bg-white px-2 py-1.5 text-sm outline-none " +
                              (conflict ? "border-warm-border focus:border-warm" : "border-line focus:border-brand-500")
                            }
                          />
                          <span className="text-ink-ghost">–</span>
                          <input
                            type="time"
                            value={r.end}
                            onChange={(e) => setRange(day, i, { end: e.target.value })}
                            className={
                              "rounded-md border bg-white px-2 py-1.5 text-sm outline-none " +
                              (conflict ? "border-warm-border focus:border-warm" : "border-line focus:border-brand-500")
                            }
                          />
                          <span className="ml-auto text-[12px] text-ink-ghost">
                            {formatBn(r.start)} - {formatBn(r.end)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeRange(day, i)}
                            aria-label="remove"
                            className="text-[13px] font-semibold text-[#DC2626]"
                          >
                            ✕
                          </button>
                        </div>
                        {conflict && (
                          <div className="mt-1 pl-1 text-[11.5px] font-semibold text-warm-heavy">
                            ⚠ {conflict.source === "other"
                              ? "অন্য চেম্বারে এই সময়টা ইতিমধ্যে বুক করা"
                              : "এই দিনেই আরেকটা সময়ের সাথে overlap হচ্ছে"}
                            {" ("}{formatBn(conflict.other.start)} - {formatBn(conflict.other.end)}{")"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>

      {byDay.size === 0 && (
        <p className="mt-1 text-[13px] text-ink-ghost">
          উপরে দিন বাছুন — প্রতিটা দিনের জন্য এক বা একাধিক সময় বসানো যাবে।
        </p>
      )}
    </div>
  );
}

/**
 * Extract (day → ranges) for use as `bookedElsewhere` when rendering another
 * chamber's picker. Skips entries we can't parse — they simply don't count as
 * "already booked" from the picker's point of view.
 */
export function scheduleToRangesByDay(entries: ScheduleEntry[]): Partial<Record<DayKey, Range[]>> {
  const out: Partial<Record<DayKey, Range[]>> = {};
  for (const e of entries) {
    for (const p of parseEntry(e)) {
      out[p.day] = [...(out[p.day] ?? []), ...p.ranges];
    }
  }
  return out;
}
