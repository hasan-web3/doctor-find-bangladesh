"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, appointments, doctors, leads } from "@/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendNotification } from "@/lib/mailer";
import { notify } from "@/lib/notify";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, num as bnNum } from "@/lib/i18n";

export type FormResult = { ok: boolean; message: string; serial?: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

const phoneSchema = z.string().regex(/^01[3-9]\d{8}$/, "সঠিক মোবাইল নম্বর দিন (০১XXXXXXXXX)");

// Cleanses and normalizes any Bangladeshi phone number format into standard 11-digit ASCII (01XXXXXXXXX)
function normalizePhone(raw: string): string {
  // 1. Convert Bangla digits to English digits
  let s = raw.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));

  // 2. Remove all non-digit characters (spaces, dashes, brackets, +, etc.)
  s = s.replace(/\D/g, "");

  // 3. Handle prefixes
  if (s.startsWith("880")) {
    s = s.slice(2); // Strip "88", leaving "0"
  } else if (s.startsWith("00880")) {
    s = s.slice(4); // Strip "0088", leaving "0"
  }

  // 4. Auto-fix missing leading zero if user inputs 10 digits starting with 1
  if (s.length === 10 && s.startsWith("1")) {
    s = "0" + s;
  }

  return s;
}

// ---------------- appointment booking ----------------
const appointmentSchema = z.object({
  doctorSlug: z.string().min(1),
  chamberId: z.coerce.number().optional(),
  patientName: z.string().min(2, "রোগীর নাম দিন"),
  phone: phoneSchema,
  age: z.string().max(10).optional(),
  problem: z.string().max(1000).optional(),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ নির্বাচন করুন"),
  timeSlot: z.string().min(1, "সময় নির্বাচন করুন"),
});

export async function submitAppointment(_prev: FormResult | null, formData: FormData): Promise<FormResult> {
  const ip = await clientIp();
  if (!rateLimit(`appt:${ip}`, 5, 10 * 60_000)) {
    return { ok: false, message: "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন। / Too many attempts. Please try again in a few minutes." };
  }
  if (!(await verifyRecaptcha(formData.get("recaptcha_token") as string | null))) {
    return { ok: false, message: "স্প্যাম যাচাই ব্যর্থ। পেজ রিলোড করে আবার চেষ্টা করুন। / Spam check failed. Please reload the page and try again." };
  }

  const parsed = appointmentSchema.safeParse({
    doctorSlug: formData.get("doctorSlug"),
    chamberId: formData.get("chamberId") || undefined,
    patientName: formData.get("patientName"),
    phone: normalizePhone(String(formData.get("phone") || "")),
    age: formData.get("age") || undefined,
    problem: formData.get("problem") || undefined,
    visitDate: formData.get("visitDate"),
    timeSlot: formData.get("timeSlot"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "তথ্যগুলো ঠিকভাবে পূরণ করুন।" };
  }
  const d = parsed.data;

  const [doctor] = await db
    .select({
      id: doctors.id,
      name_bn: sql<string>`${doctors.name}->>'bn'`,
      name_en: sql<string>`${doctors.name}->>'en'`,
    })
    .from(doctors)
    .where(and(eq(doctors.slug, d.doctorSlug), eq(doctors.active, true)))
    .limit(1);
  if (!doctor) return { ok: false, message: "ডাক্তার খুঁজে পাওয়া যায়নি।" };

  const serial = `DB-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  // `.returning` gives the row id the admin list keys on — the notification
  // stores that, not the serial, so the new booking can be matched to its row
  // and highlighted until someone opens it.
  const [booked] = await db.insert(appointments).values({
    serialNo: serial,
    doctorId: doctor.id,
    chamberId: d.chamberId ?? null,
    patientName: d.patientName,
    phone: d.phone,
    age: d.age ?? null,
    problem: d.problem ?? null,
    visitDate: d.visitDate,
    timeSlot: d.timeSlot,
  }).returning({ id: appointments.id });

  // Dashboard badge on /admin/appointments. `source: "public"` — the booking
  // came from the website, so there is no admin panel that already saw it.
  await notify({
    panel: "appointments",
    kind: "appointment.new",
    entityId: booked?.id,
    title: {
      bn: `নতুন অ্যাপয়েন্টমেন্ট: ${d.patientName}`,
      en: `New appointment: ${d.patientName}`,
    },
    body: {
      bn: `${doctor.name_bn} • ${d.visitDate} ${d.timeSlot} • ${d.phone}`,
      en: `${doctor.name_en || doctor.name_bn} • ${d.visitDate} ${d.timeSlot} • ${d.phone}`,
    },
    href: "/admin/appointments",
    source: "public",
  });

  // Fire-and-forget email; booking never depends on SMTP being configured.
  sendNotification(
    `নতুন অ্যাপয়েন্টমেন্ট: ${d.patientName} → ${doctor.name_bn}`,
    `<p><b>রোগী:</b> ${d.patientName}<br/><b>ফোন:</b> ${d.phone}<br/>
     <b>ডাক্তার:</b> ${doctor.name_bn}<br/><b>তারিখ:</b> ${d.visitDate} ${d.timeSlot}<br/>
     <b>সিরিয়াল:</b> ${serial}<br/><b>সমস্যা:</b> ${d.problem || "-"}</p>`
  ).catch(() => {});

  const storedLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(storedLocale) ? storedLocale : DEFAULT_LOCALE;

  return { ok: true, message: "আপনার সিরিয়াল সফলভাবে বুক হয়েছে।", serial: bnNum(serial, locale) };
}

// ---------------- leads (contact + doctor promotion) ----------------
const leadSchema = z.object({
  type: z.enum(["patient", "doctor"]),
  name: z.string().min(2, "নাম লিখুন"),
  phone: phoneSchema,
  message: z.string().max(2000).optional(),
  extra: z.string().optional(),
});

export async function submitLead(_prev: FormResult | null, formData: FormData): Promise<FormResult> {
  const ip = await clientIp();
  if (!rateLimit(`lead:${ip}`, 5, 10 * 60_000)) {
    return { ok: false, message: "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন। / Too many attempts. Please try again in a few minutes." };
  }
  if (!(await verifyRecaptcha(formData.get("recaptcha_token") as string | null))) {
    return { ok: false, message: "স্প্যাম যাচাই ব্যর্থ। পেজ রিলোড করে আবার চেষ্টা করুন। / Spam check failed. Please reload the page and try again." };
  }

  const parsed = leadSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name"),
    phone: normalizePhone(String(formData.get("phone") || "")),
    message: formData.get("message") || undefined,
    extra: formData.get("extra") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "তথ্যগুলো ঠিকভাবে পূরণ করুন।" };
  }
  const d = parsed.data;

  // Same reason as the appointment above: the notification needs the row id so
  // the leads list can highlight this one until it is opened.
  const [created] = await db
    .insert(leads)
    .values({
      type: d.type,
      name: d.name,
      phone: d.phone,
      message: d.message ?? null,
      extra: d.extra ? { note: d.extra } : {},
    })
    .returning({ id: leads.id });

  // Dashboard badge on /admin/leads.
  await notify({
    panel: "leads",
    kind: "lead.new",
    entityId: created?.id,
    title: { bn: `নতুন লিড: ${d.name}`, en: `New lead: ${d.name}` },
    body: {
      bn: `${d.type === "doctor" ? "ডাক্তার প্রমোশন" : "রোগী সহায়তা"} • ${d.phone}`,
      en: `${d.type === "doctor" ? "Doctor promotion" : "Patient support"} • ${d.phone}`,
    },
    href: "/admin/leads",
    source: "public",
  });

  sendNotification(
    `নতুন লিড (${d.type === "doctor" ? "ডাক্তার প্রমোশন" : "রোগী সহায়তা"}): ${d.name}`,
    `<p><b>নাম:</b> ${d.name}<br/><b>ফোন:</b> ${d.phone}<br/><b>বার্তা:</b> ${d.message || "-"}</p>`
  ).catch(() => {});

  return { ok: true, message: "আপনার তথ্য পাঠানো হয়েছে। আমরা দ্রুত যোগাযোগ করব।" };
}

// ---------------- geo area choice ----------------
export async function chooseArea(slug: string) {
  const jar = await cookies();
  if (!slug) {
    jar.delete("db_area");
    return;
  }
  jar.set("db_area", slug, { maxAge: 5, path: "/", sameSite: "lax" });
}
