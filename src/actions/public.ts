"use server";

import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, appointments, chambers, doctors, leads } from "@/db";
import { rateLimit } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mailer";
import { getSettings } from "@/lib/settings";
import {
  appointmentOwnerEmail,
  appointmentPatientEmail,
  brandOf,
  contactConfirmationEmail,
} from "@/lib/email-templates";
import { notify } from "@/lib/notify";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, num as bnNum } from "@/lib/i18n";
import { DISTRICT_COOKIE, DISTRICT_COOKIE_MAX_AGE } from "@/lib/geo";
import { getDistrictsForGeo } from "@/lib/data";

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
  // Optional. When present the patient gets a confirmation email, so it has to
  // be a valid address rather than whatever they typed.
  email: z.string().trim().toLowerCase().email("সঠিক ইমেইল দিন").optional(),
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
    email: formData.get("email") || undefined,
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

  // The serial is self-contained (timestamp + random), not a per-chamber
  // counter, so it stays valid whether or not the booking is written to the
  // database below.
  const serial = `DB-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

  // The chamber owns its own email routing and its own serial phone line.
  const chamber = d.chamberId
    ? (
        await db
          .select({
            name_bn: sql<string>`${chambers.name}->>'bn'`,
            address_bn: sql<string>`${chambers.address}->>'bn'`,
            phone: chambers.phone,
            fee: chambers.fee,
            ownerEmail: chambers.ownerEmail,
            bccEmail: chambers.bccEmail,
            fromEmail: chambers.fromEmail,
          })
          .from(chambers)
          .where(and(eq(chambers.id, d.chamberId), eq(chambers.doctorId, doctor.id)))
          .limit(1)
      )[0] ?? null
    : null;

  const bccList = (chamber?.bccEmail || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  after(async () => {
    // Mail first: whether the booking needs to be kept on the dashboard
    // depends on whether anyone was actually told about it.
    let ownerNotified = false;
    try {
      ownerNotified = await sendAppointmentEmails({
        patientName: d.patientName,
        phone: d.phone,
        email: d.email,
        age: d.age,
        problem: d.problem,
        visitDate: d.visitDate,
        timeSlot: d.timeSlot,
        serial,
        doctorName: doctor.name_bn,
        doctorSlug: d.doctorSlug,
        chamber,
        bccList,
      });
    } catch (e) {
      console.error("[appointment-email] send failed", e);
    }

    // A chamber with a BCC address is notified by email, so the booking is
    // deliberately NOT kept in the database or shown on the dashboard — that is
    // the requested behaviour, to stop the table filling up with rows nobody
    // reads. The `!ownerNotified` half is the safety net: if the mail did not
    // actually go out, the premise fails and the booking is persisted instead
    // of vanishing.
    const persist = bccList.length === 0 || !ownerNotified;
    if (!persist) return;

    try {
      // `.returning` gives the row id the admin list keys on — the notification
      // stores that, not the serial, so the new booking can be matched to its
      // row and highlighted until someone opens it.
      const [booked] = await db
        .insert(appointments)
        .values({
          serialNo: serial,
          doctorId: doctor.id,
          chamberId: d.chamberId ?? null,
          patientName: d.patientName,
          phone: d.phone,
          email: d.email ?? null,
          age: d.age ?? null,
          problem: d.problem ?? null,
          visitDate: d.visitDate,
          timeSlot: d.timeSlot,
        })
        .returning({ id: appointments.id });

      // Dashboard badge on /admin/appointments. `source: "public"` — the
      // booking came from the website, so no admin panel has seen it already.
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
    } catch (e) {
      console.error("[appointment] persist failed", e);
    }
  });

  const storedLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(storedLocale) ? storedLocale : DEFAULT_LOCALE;

  return { ok: true, message: "আপনার সিরিয়াল সফলভাবে বুক হয়েছে।", serial: bnNum(serial, locale) };
}

/**
 * Appointment mail. Two messages, both optional in their own way:
 *   - the chamber copy, to the owner address with any BCC addresses attached
 *   - the patient copy, only when they gave an address
 *
 * Returns whether the chamber copy actually went out, because that is what
 * decides if the booking still needs to land on the dashboard.
 * A chamber missing any one of owner / BCC / from must not break the other
 * email, so each half is attempted independently.
 */
async function sendAppointmentEmails(a: {
  patientName: string;
  phone: string;
  email?: string;
  age?: string;
  problem?: string;
  visitDate: string;
  timeSlot: string;
  serial: string;
  doctorName: string;
  doctorSlug: string;
  chamber: {
    name_bn: string | null;
    address_bn: string | null;
    phone: string | null;
    fee: number | null;
    ownerEmail: string | null;
    bccEmail: string | null;
    fromEmail: string | null;
  } | null;
  bccList: string[];
}): Promise<boolean> {
  const settings = await getSettings();
  const from = a.chamber?.fromEmail?.trim() || "noreply@doctorsfindbd.com";
  const fromName = brandOf(settings);

  const payload = {
    patientName: a.patientName,
    phone: a.phone,
    email: a.email,
    age: a.age,
    problem: a.problem,
    visitDate: a.visitDate,
    timeSlot: a.timeSlot,
    serial: a.serial,
    doctorName: a.doctorName,
    doctorSlug: a.doctorSlug,
    chamberName: a.chamber?.name_bn,
    chamberAddress: a.chamber?.address_bn,
    chamberPhone: a.chamber?.phone,
    fee: a.chamber?.fee,
    settings,
  };

  // --- chamber copy ---
  const owner = a.chamber?.ownerEmail?.trim() || "";
  let ownerNotified = false;
  // With no owner address the BCC list still needs a To: header, so the sender
  // takes that slot and the real recipients stay on BCC.
  const ownerTo = owner || (a.bccList.length ? from : "");
  if (ownerTo) {
    const mail = appointmentOwnerEmail(payload);
    const res = await sendMail({
      from,
      fromName,
      to: ownerTo,
      bcc: a.bccList.length ? a.bccList : undefined,
      subject: mail.subject,
      html: mail.html,
      replyTo: a.email || undefined,
      tags: [{ name: "type", value: "appointment_owner" }],
    });
    ownerNotified = res.ok;
    if (!res.ok) console.error("[appointment-email] chamber copy not sent:", res.message);
  }

  // --- patient copy ---
  if (a.email) {
    const mail = appointmentPatientEmail(payload);
    const res = await sendMail({
      from,
      fromName,
      to: a.email,
      subject: mail.subject,
      html: mail.html,
      replyTo: owner || undefined,
      headers: { "Auto-Submitted": "auto-replied" },
      tags: [{ name: "type", value: "appointment_patient" }],
    });
    if (!res.ok) console.error("[appointment-email] patient copy not sent:", res.message);
  }

  return ownerNotified;
}

// ---------------- leads (contact + doctor promotion) ----------------
const leadSchema = z.object({
  type: z.enum(["patient", "doctor"]),
  name: z.string().min(2, "নাম লিখুন"),
  phone: phoneSchema,
  // Optional. When present we send the visitor a confirmation, so it has to be
  // a valid address rather than whatever they typed.
  email: z.string().trim().toLowerCase().email("সঠিক ইমেইল দিন").optional(),
  message: z.string().trim().min(1, "আপনার বার্তা লিখুন").max(2000),
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
    email: formData.get("email") || undefined,
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
      email: d.email ?? null,
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
    // One contact form now feeds this, so there is no lead "kind" left to
    // label — the phone number is the useful half of the badge.
    body: { bn: `যোগাযোগ • ${d.phone}`, en: `Contact • ${d.phone}` },
    href: "/admin/leads",
    source: "public",
  });

  // Mail must not block the visitor's response, but a bare un-awaited promise
  // does not survive: the server action returns, the runtime tears the
  // invocation down, and the fetch to Resend never leaves the process. That is
  // exactly why a submitted lead saved fine while no email was ever sent.
  // `after()` defers the work until AFTER the response and keeps the
  // invocation alive for it.
  after(async () => {
    try {
      await sendContactEmails(d);
    } catch (e) {
      // Swallowing this silently is what made the bug above invisible.
      console.error("[contact-email] send failed", e);
    }
  });

  return { ok: true, message: "আপনার তথ্য পাঠানো হয়েছে। আমরা দ্রুত যোগাযোগ করব।" };
}

/**
 * One email per contact submission, sent FROM the contact address.
 *
 * When the visitor supplied an email it goes to them, with the team on BCC.
 * When they did not, only the BCC copies go out — but a message still needs at
 * least one To: recipient, so the contact address receives its own copy and the
 * visitor is simply not addressed. Nothing is sent when there is no visitor
 * address and no BCC list configured.
 */
async function sendContactEmails(d: {
  name: string;
  phone: string;
  email?: string;
  message: string;
}) {
  const settings = await getSettings();
  const from = settings.contact_email_from?.trim() || "contact@doctorsfindbd.com";
  const bcc = (settings.contact_email_bcc || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!d.email && !bcc.length) return;

  const mail = contactConfirmationEmail({ ...d, settings });
  const res = await sendMail({
    from,
    fromName: brandOf(settings),
    to: d.email || from,
    bcc: bcc.length ? bcc : undefined,
    subject: mail.subject,
    html: mail.html,
    // RFC 3834: marks this as an automatic reply so mail servers do not treat
    // it as conversation and never bounce-loop against it.
    headers: { "Auto-Submitted": "auto-replied" },
    tags: [{ name: "type", value: "contact_confirmation" }],
  });

  // sendMail reports provider failures in its return value rather than
  // throwing, so this is the only place a bad key or an unverified sending
  // domain becomes visible.
  if (!res.ok) console.error("[contact-email] not sent:", res.message);
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

// ---------------- geo district choice ----------------
// The visitor told us their district. Persist it for 30 days and let
// detectArea() serve the whole site from it instead of their IP.
//
// A cookie (not localStorage) because every geo-aware surface on this site is
// server-rendered — the district has to be readable before the first byte, or
// the page would ship the IP-derived ordering and then rewrite it on the
// client, which is both a flash and a wasted render.
export async function chooseDistrict(slug: string) {
  const jar = await cookies();
  if (!slug) {
    jar.delete(DISTRICT_COOKIE);
    return { ok: false };
  }

  // Only accept a slug we actually serve — this value is echoed into SQL
  // filters downstream, and an unknown slug would silently degrade every
  // listing to "no location" instead of erroring visibly.
  const districts = (await getDistrictsForGeo()) as { slug: string }[];
  if (!districts.some((x) => x.slug === slug)) return { ok: false };

  jar.set(DISTRICT_COOKIE, slug, {
    maxAge: DISTRICT_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });
  // A stale thana pick outranks the district cookie in detectArea(), so a
  // fresh district answer has to clear it or the new choice does nothing.
  jar.delete("db_area");
  return { ok: true };
}
