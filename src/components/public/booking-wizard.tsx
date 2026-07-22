"use client";

import { useEffect, useMemo } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Link from "next/link";
import { useActionState } from "react";
import { submitAppointment, type FormResult } from "@/actions/public";
import { useBookingContext } from "@/components/public/booking-context";
import { localeHref, num, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";
import { cn } from "@/lib/utils";

const EN_DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const BN_DAYS_SHORT = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];
const EN_DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Helper to get today's date in a consistent, local-timezone format.
const todayIso = () => {
  const dt = new Date();
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

type Chamber = { id: number; name: string; area: string; fee: number; schedule: Array<{ days: string; time: string }> };

type BookingDict = Pick<Dict,
  "step_datetime" | "step_patient" | "step_confirm" | "select_chamber" | "select_date" |
  "select_time" | "next_step" | "prev_step" | "patient_info_title" | "patient_name" |
  "patient_name_placeholder" | "mobile_number" | "age" | "age_placeholder" | "problem_label" |
  "problem_placeholder" | "confirm_booking" | "booking_pending" | "booking_success_title" |
  "booking_success_sub" | "doctor_label" | "datetime_label" | "serial_label" | "back_home" |
  "no_slots_for_day" | "fee" | "taka">;

const DAY_ALIASES: Record<string, string> = {};
{
  const dayIdxToEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const bnFull   = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
  const bnShort  = ["রবি",   "সোম",   "মঙ্গল",   "বুধ",   "বৃহঃ",       "শুক্র",     "শনি"];
  const enShort  = ["Sun",   "Mon",   "Tue",     "Wed",   "Thu",         "Fri",       "Sat"];
  for (let i = 0; i < 7; i++) {
    const en = dayIdxToEn[i];
    DAY_ALIASES[en.toLowerCase()] = en;
    DAY_ALIASES[enShort[i].toLowerCase()] = en;
    DAY_ALIASES[bnFull[i]] = en;
    DAY_ALIASES[bnShort[i]] = en;
  }
  DAY_ALIASES["মোঙ্গল"] = "Tuesday";
  DAY_ALIASES["বৃহস্পতি"] = "Thursday";
}

function tokenToEnDay(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (DAY_ALIASES[t]) return DAY_ALIASES[t];
  if (DAY_ALIASES[t.toLowerCase()]) return DAY_ALIASES[t.toLowerCase()];
  return null;
}

const getScheduledDays = (chamber: Chamber | undefined): string[] => {
  if (!chamber?.schedule) return [];
  const scheduledDayNames = new Set<string>();
  chamber.schedule.forEach((s) => {
    const days = s.days.split(/[,،/।]+/).map((d) => d.trim()).filter(Boolean);
    days.forEach((day) => {
      const en = tokenToEnDay(day);
      if (en) scheduledDayNames.add(en);
    });
  });
  return Array.from(scheduledDayNames);
};

export function BookingWizard({
  doctorSlug,
  doctorName,
  chambers,
  initialChamberId,
  locale,
  d,
}: {
  doctorSlug: string;
  doctorName: string;
  chambers: Chamber[];
  initialChamberId: number | null;
  locale: Locale;
  d: BookingDict;
}) {
  const {
    step, setStep,
    date, setDate,
    slot, setSlot,
    chamberId, setChamberId,
    patientName, setPatientName,
    phone, setPhone,
    age, setAge,
    problem, setProblem,
  } = useBookingContext();

  const [result, formAction, pending] = useActionState<FormResult | null, FormData>(submitAppointment, null);
  const [parent] = useAutoAnimate();
  
  useEffect(() => {
    if (initialChamberId) {
      setChamberId(initialChamberId);
    } else if (chambers.length > 0 && !chamberId) {
      setChamberId(chambers[0].id);
    }
  }, [initialChamberId, chamberId, setChamberId, chambers]);

  const selectedChamber = useMemo(() => chambers.find((c) => c.id === chamberId), [chamberId, chambers]);
  const scheduledDaysForChamber = useMemo(() => getScheduledDays(selectedChamber), [selectedChamber]);

  const dates = useMemo(() => {
    const list: { iso: string; day: string; num: string; month: string; available: boolean }[] = [];
    const daysShort = locale === "bn" ? BN_DAYS_SHORT : EN_DAYS_SHORT;
    const monthNames = locale === "bn" ? BN_MONTHS : EN_MONTHS;
    for (let i = 0; i < 7; i++) {
      const dt = new Date();
      dt.setDate(dt.getDate() + i);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const dayName = EN_DAYS_FULL[dt.getDay()];
      list.push({
        iso: `${yyyy}-${mm}-${dd}`,
        day: daysShort[dt.getDay()],
        num: num(dt.getDate(), locale),
        month: monthNames[dt.getMonth()],
        available: scheduledDaysForChamber.includes(dayName),
      });
    }
    return list;
  }, [locale, scheduledDaysForChamber]);

  const availableSlots = useMemo(() => {
    if (!selectedChamber || !date) return [];
    const dayName = EN_DAYS_FULL[new Date(date + "T00:00:00").getDay()];
    const scheduleForDay = selectedChamber.schedule.find((s) =>
      s.days.split(/[,،/।]+/).map((d) => d.trim()).some((tok) => tokenToEnDay(tok) === dayName)
    );
    if (!scheduleForDay) return [];
    return [...new Set(scheduleForDay.time.split(/, ?/g).map((t) => t.trim()).filter(Boolean))];
  }, [selectedChamber, date]);

  const handleChamberChange = (id: number) => {
    setChamberId(id);
    setSlot("");
    setDate(todayIso());
  };

  const handleDateChange = (iso: string) => {
    setDate(iso);
    setSlot("");
  };

  const effectiveStep = result?.ok ? 3 : step;
  const steps = [
    { n: num(1, locale), label: d.step_datetime },
    { n: num(2, locale), label: d.step_patient },
    { n: num(3, locale), label: d.step_confirm },
  ];

  return (
    <>
      <div className="mb-7 flex items-center">
        {steps.map((s, i) => {
          const idx = i + 1;
          const active = effectiveStep === idx;
          const done = effectiveStep > idx;
          return (
            <div key={s.n} className="flex flex-1 items-center justify-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-[38px] w-[38px] items-center justify-center rounded-full font-heading font-bold",
                    active ? "bg-brand-600 text-white" : done ? "bg-accent text-white" : "bg-line text-ink-ghost"
                  )}
                >
                  {done ? "✓" : s.n}
                </div>
                <span className={cn("whitespace-nowrap text-[12.5px] font-semibold", active ? "text-brand-700" : "text-ink-ghost")}>
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div ref={parent} className="rounded-[18px] border border-line bg-white p-6">
        {effectiveStep === 1 && (
          <div>
            {chambers.length > 1 && (
              <>
                <h3 className="mb-3.5 mt-0 font-heading text-lg font-bold text-ink">{d.select_chamber}</h3>
                <div className="mb-6 flex flex-col gap-2.5">
                  {chambers.map((c) => (
                    <button key={c.id} onClick={() => handleChamberChange(c.id)} className={cn("flex items-center justify-between rounded-xl border-[1.5px] px-4 py-3", chamberId === c.id ? "border-brand-600 bg-brand-50" : "border-line bg-white")}>
                      <span className="text-[14.5px] font-semibold text-ink">{c.name}{c.area ? `, ${c.area}` : ""}</span>
                      <span className="text-sm text-brand-700">{d.fee} {num(c.fee, locale)} {d.taka}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <h3 className="mb-3.5 mt-0 font-heading text-lg font-bold text-ink">{d.select_date}</h3>
            <div className="mb-6 grid grid-cols-3 gap-2.5 sm:grid-cols-4 min-[900px]:grid-cols-7">
              {dates.map((dt) => {
                const sel = date === dt.iso;
                return (
                  <button key={dt.iso} type="button" onClick={() => handleDateChange(dt.iso)} aria-label={`${dt.day} ${dt.num} ${dt.month}${!dt.available ? " (no schedule)" : ""}`} className={cn("rounded-xl border-[1.5px] px-2 py-3 text-center transition-colors", sel && "border-brand-600 bg-brand-50", !sel && "border-line bg-white hover:border-brand-300", !dt.available && "opacity-60")}>
                    <div className={cn("text-[12.5px]", dt.available ? "text-ink-faint" : "text-slate-400")}>{dt.day}</div>
                    <div className={cn("font-heading text-xl font-bold", dt.available ? (sel ? "text-brand-700" : "text-ink") : "text-slate-400")}>{dt.num}</div>
                    <div className={cn("text-[11px]", dt.available ? "text-ink-ghost" : "text-slate-400")}>{dt.month}</div>
                  </button>
                );
              })}
            </div>
            <h3 className="mb-3.5 mt-0 font-heading text-lg font-bold text-ink">{d.select_time}</h3>
            {availableSlots.length > 0 ? (
              <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {availableSlots.map((slotOption) => {
                  const sel = slot === slotOption;
                  return <button key={slotOption} onClick={() => setSlot(slotOption)} className={cn("rounded-[11px] border-[1.5px] px-3 py-3 text-[14.5px] font-semibold", sel ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line bg-white text-ink-soft")}>{slotOption}</button>;
                })}
              </div>
            ) : (
              <div className="mb-6 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6 text-center text-sm font-medium text-amber-800">{d.no_slots_for_day ?? "এই দিনের জন্য কোনো অ্যাপয়েন্টমেন্ট স্লট উপলব্ধ নেই।"}</div>
            )}
            <button disabled={!date || !slot || availableSlots.length === 0} onClick={() => setStep(2)} className="w-full rounded-xl bg-brand-600 p-3.5 text-[15.5px] font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50">{d.next_step}</button>
          </div>
        )}
        {effectiveStep === 2 && (
          <form action={formAction}>
            <input type="hidden" name="doctorSlug" value={doctorSlug} />
            <input type="hidden" name="visitDate" value={date} />
            <input type="hidden" name="timeSlot" value={slot} />
            {chamberId != null && <input type="hidden" name="chamberId" value={chamberId} />}
            <h3 className="mb-4 mt-0 font-heading text-lg font-bold text-ink">{d.patient_info_title}</h3>
            <div className="mb-6 flex flex-col gap-3.5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-soft">{d.patient_name}</label>
                <input name="patientName" required value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder={d.patient_name_placeholder} className="w-full rounded-[11px] border border-line px-3.5 py-3 text-[15px] outline-none focus:border-brand-600" />
              </div>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-soft">{d.mobile_number}</label>
                  <input name="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" className="w-full rounded-[11px] border border-line px-3.5 py-3 text-[15px] outline-none focus:border-brand-600" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink-soft">{d.age}</label>
                  <input name="age" value={age} onChange={(e) => setAge(e.target.value)} placeholder={d.age_placeholder} className="w-full rounded-[11px] border border-line px-3.5 py-3 text-[15px] outline-none focus:border-brand-600" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink-soft">{d.problem_label}</label>
                <textarea name="problem" rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder={d.problem_placeholder} className="w-full resize-y rounded-[11px] border border-line px-3.5 py-3 font-body text-[15px] outline-none focus:border-brand-600" />
              </div>
            </div>
            {result && !result.ok && <div className="mb-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#DC2626]">{result.message}</div>}
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-xl border-[1.5px] border-line bg-white p-3.5 text-center text-[15px] font-semibold text-ink-mute transition-colors hover:bg-slate-50">{d.prev_step}</button>
              <button type="submit" disabled={pending} className="flex-[2] rounded-xl bg-brand-600 p-3.5 text-center text-[15.5px] font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? d.booking_pending : d.confirm_booking}</button>
            </div>
          </form>
        )}
        {effectiveStep === 3 && result?.ok && (
          <div className="py-3.5 text-center">
            <div className="mx-auto mb-[18px] flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent-soft text-4xl text-accent">✓</div>
            <h3 className="mb-2 mt-0 font-heading text-[22px] font-bold text-ink">{d.booking_success_title}</h3>
            <p className="mb-5 text-[15px] text-ink-mute">{d.booking_success_sub}</p>
            <div className="mx-auto mb-[22px] max-w-[400px] rounded-[14px] border border-line bg-page p-[18px] text-right">
              <div className="flex justify-between py-[7px] text-[14.5px]"><span className="text-ink-faint">{d.doctor_label}</span><span className="font-semibold text-ink">{doctorName}</span></div>
              <div className="flex justify-between border-t border-line py-[7px] text-[14.5px]"><span className="text-ink-faint">{d.datetime_label}</span><span className="font-semibold text-ink">{num(date, locale)} · {slot}</span></div>
              <div className="flex justify-between border-t border-line py-[7px] text-[14.5px]"><span className="text-ink-faint">{d.serial_label}</span><span className="font-semibold text-brand-600">#{result.serial}</span></div>
            </div>
            <Link href={localeHref(locale, "/")} className="inline-block rounded-xl bg-brand-600 px-7 py-[13px] text-[15px] font-bold text-white">{d.back_home}</Link>
          </div>
        )}
      </div>
    </>
  );
}
