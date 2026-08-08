"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db, doctorSubmissions } from "@/db";
import { rateLimit } from "@/lib/rate-limit";
import { verifyRecaptcha } from "@/lib/recaptcha";
import { uploadImage } from "@/lib/storage";
import { getSettings } from "@/lib/settings";
import { sendMail } from "@/lib/mailer";
import { brandOf, doctorFormSubmittedEmail } from "@/lib/email-templates";
import { notify } from "@/lib/notify";
import { toLatinDigits, type IntakeResult } from "@/lib/doctor-intake";

// The ONE public entry point for the client-facing doctor form.
//
// There is deliberately no login on the client side — the doctor being listed is
// not a user of this site and never will be. Everything that protects this
// endpoint is here instead:
//
//   1. The link token. 32 random URL-safe bytes, unguessable, and claimed
//      ATOMICALLY on submit (UPDATE ... WHERE submitted_at IS NULL), so a
//      double-click, a replayed request or a forwarded link can never produce a
//      second submission. This is also what makes the link single-use.
//   2. A per-IP rate limit, so a leaked token can't be used to hammer R2.
//   3. reCAPTCHA v3 when the integration is on — same helper the contact and
//      booking forms use, and equally optional.
//   4. A honeypot field plus a minimum on-screen time. Both are free, and
//      together they stop the scripted form-fillers that never load the page.
//   5. The page itself is noindex and disallowed in robots.txt, so the URL never
//      enters an index in the first place.

const mlOptional = z.object({
  bn: z.string().trim().default(""),
  en: z.string().trim().default(""),
});

const draftSchema = z.object({
  // The one bilingual field: the name heads the profile on both locale pages.
  name: z.object({
    bn: z.string().trim().min(1, "ডাক্তারের নাম বাংলায় লিখুন"),
    en: z.string().trim().min(1, "ডাক্তারের নাম ইংরেজিতে লিখুন / in English"),
  }),
  // Everything below takes one value in whichever language the client chose.
  degrees: z.string().trim().min(2, "ডিগ্রি ও পদবি লিখুন"),
  bio: z.string().trim().min(10, "পরিচিতি লিখুন"),
  gender: z.enum(["male", "female", "other"], { errorMap: () => ({ message: "লিঙ্গ নির্বাচন করুন" }) }),
  experience_years: z.string().trim().default(""),
  patients_served: z.string().trim().default(""),
  treated_conditions: z.string().trim().min(2, "যে সকল রোগের চিকিৎসা করা হয় তা লিখুন"),
  hospital: z.string().trim().min(2, "প্রধান হাসপাতালের নাম লিখুন"),
  specialty: z.string().trim().min(2, "বিশেষজ্ঞ বিভাগ লিখুন"),
  chamber_name: z.string().trim().min(2, "চেম্বারের নাম লিখুন"),
  address: z.string().trim().min(2, "চেম্বারের ঠিকানা লিখুন"),
  district: z.string().trim().min(2, "জেলার নাম লিখুন"),
  area: z.string().trim().min(2, "শহর / গ্রাম / থানার নাম লিখুন"),
  fee: z.string().trim().min(1, "ভিজিট ফি লিখুন"),
  // Chambers hand out landlines, multiple numbers, sometimes an extension — a
  // strict 01XXXXXXXXX rule would reject perfectly good serial lines, so this
  // only insists on enough digits to be a real number.
  serial_phone: z.string().trim().min(6, "সিরিয়াল নম্বর লিখুন"),
  owner_email: z.string().trim().default(""),
  map_url: z.string().trim().default(""),
  schedule: z
    .array(z.object({ days: mlOptional, time: mlOptional }))
    .min(1, "চেম্বারের সময়সূচি দিন"),
  social_links: z
    .object({
      website: z.string().trim().default(""),
      linkedin: z.string().trim().default(""),
      facebook: z.string().trim().default(""),
      twitter: z.string().trim().default(""),
      instagram: z.string().trim().default(""),
      youtube: z.string().trim().default(""),
      researchgate: z.string().trim().default(""),
    })
    .default({}),
});

const payloadSchema = z.object({
  token: z.string().trim().min(10),
  draft: draftSchema,
  photo_data: z.string().optional(),
  recaptcha_token: z.string().optional(),
  trap: z.string().optional(),
  elapsed_ms: z.number().optional(),
});

/** Same rule the admin form applies: only real https URLs reach the database. */
function cleanSocialLinks(input: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    const url = (v || "").trim();
    if (url && /^https?:\/\//i.test(url)) out[k] = url;
  }
  return out;
}

/**
 * Clients paste whatever Google gave them: a share link, a full <iframe>, or a
 * plain URL. Unwrap the iframe form and drop anything that isn't http(s), so a
 * `javascript:` string can never be stored and later rendered.
 */
function extractMapUrl(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  const iframe = s.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  if (iframe) return iframe[1].trim();
  return /^https?:\/\//i.test(s) ? s : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

export async function submitDoctorIntake(payload: unknown): Promise<IntakeResult> {
  const ip = await clientIp();
  if (!rateLimit(`intake:${ip}`, 8, 15 * 60_000)) {
    return {
      ok: false,
      message: "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন। / Too many attempts, please try again shortly.",
    };
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "তথ্যগুলো ঠিকভাবে পূরণ করুন।" };
  }
  const { token, draft } = parsed.data;

  // Honeypot + timing. Both are silent: a bot gets the same wording a human
  // would see for a genuine problem, and never learns which check tripped.
  if ((parsed.data.trap || "").trim()) {
    return { ok: false, message: "ফর্মটি জমা দেওয়া যায়নি। পেজ রিলোড করে আবার চেষ্টা করুন।" };
  }
  if (typeof parsed.data.elapsed_ms === "number" && parsed.data.elapsed_ms < 4000) {
    return { ok: false, message: "ফর্মটি জমা দেওয়া যায়নি। পেজ রিলোড করে আবার চেষ্টা করুন।" };
  }

  if (!(await verifyRecaptcha(parsed.data.recaptcha_token))) {
    return { ok: false, message: "স্প্যাম যাচাই ব্যর্থ। পেজ রিলোড করে আবার চেষ্টা করুন।" };
  }

  if (!parsed.data.photo_data?.startsWith("data:image")) {
    return { ok: false, message: "ডাক্তারের ছবি যুক্ত করুন।" };
  }

  const ownerEmail = draft.owner_email.trim();
  if (ownerEmail && !EMAIL_RE.test(ownerEmail)) {
    return { ok: false, message: "চেম্বার মালিকের ইমেইল ঠিকভাবে লিখুন, না থাকলে খালি রাখুন।" };
  }

  const fee = Number(toLatinDigits(draft.fee).replace(/[^\d]/g, ""));
  if (!Number.isFinite(fee) || fee < 0) {
    return { ok: false, message: "ভিজিট ফি সংখ্যায় লিখুন।" };
  }
  const experienceRaw = toLatinDigits(draft.experience_years).replace(/[^\d]/g, "");
  const experienceYears = experienceRaw === "" ? null : Number(experienceRaw);

  // ---- claim the link (this is the single-use guarantee) ----
  // One statement decides everything: the token has to exist AND still be
  // unused, and the same statement marks it used. Nothing between a check and a
  // write, so two simultaneous submits can never both win.
  const claim = await db.execute<{
    id: number; client_name: string; client_phone: string; client_email: string | null;
  }>(sql`
    UPDATE doctor_form_links
       SET submitted_at = now()
     WHERE token = ${token} AND submitted_at IS NULL
    RETURNING id, client_name, client_phone, client_email
  `);
  const link = claim.rows[0];
  if (!link) {
    // Either the token never existed or it has already been used. The client
    // gets the same sentence in both cases — telling them apart would let
    // someone probe for valid tokens.
    return {
      ok: false,
      message: "এই লিংক দিয়ে ফর্মটি আর জমা দেওয়া যাবে না। নতুন লিংকের জন্য আমাদের সাথে যোগাযোগ করুন।",
    };
  }

  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) || null;

  try {
    const photo = await uploadImage(parsed.data.photo_data, "doctors");

    const data = {
      name: draft.name,
      degrees: draft.degrees,
      bio: draft.bio,
      gender: draft.gender,
      experience_years: experienceYears,
      patients_served: draft.patients_served,
      treated_conditions: draft.treated_conditions,
      hospital: draft.hospital,
      specialty: draft.specialty,
      chamber_name: draft.chamber_name,
      address: draft.address,
      district: draft.district,
      area: draft.area,
      fee,
      serial_phone: draft.serial_phone,
      owner_email: ownerEmail,
      map_url: extractMapUrl(draft.map_url),
      schedule: draft.schedule,
      social_links: cleanSocialLinks(draft.social_links),
    };

    const [row] = await db
      .insert(doctorSubmissions)
      .values({
        linkId: link.id,
        clientName: link.client_name,
        clientPhone: link.client_phone,
        clientEmail: link.client_email,
        doctorNameBn: draft.name.bn,
        doctorNameEn: draft.name.en,
        hospital: draft.hospital,
        specialty: draft.specialty,
        district: draft.district,
        area: draft.area,
        serialPhone: draft.serial_phone,
        fee,
        ownerEmail: ownerEmail || null,
        photoKey: photo.key,
        photoUrl: photo.url,
        data,
        ip,
        userAgent,
      })
      .returning({ id: doctorSubmissions.id });

    // Dashboard badge on /admin/doctor-forms.
    await notify({
      panel: "doctor-forms",
      kind: "doctor_form.submitted",
      entityId: row?.id,
      title: { bn: `নতুন ডাক্তার ফর্ম: ${draft.name.bn}`, en: `New doctor form: ${draft.name.en}` },
      body: {
        bn: `${link.client_name} • ${link.client_phone}`,
        en: `${link.client_name} • ${link.client_phone}`,
      },
      href: "/admin/doctor-forms",
      source: "public",
    });

    // Mail after the response. A bare un-awaited promise here would never leave
    // the process — the invocation is torn down as soon as the action returns.
    after(async () => {
      try {
        const settings = await getSettings();
        const from = settings.contact_email_from?.trim() || "contact@doctorsfindbd.com";
        const bcc = (settings.contact_email_bcc || "")
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);
        const mail = doctorFormSubmittedEmail({
          clientName: link.client_name,
          clientPhone: link.client_phone,
          clientEmail: link.client_email,
          doctorName: draft.name.bn || draft.name.en,
          hospital: draft.hospital,
          specialty: draft.specialty,
          chamberName: draft.chamber_name,
          district: draft.district,
          area: draft.area,
          fee,
          serialPhone: draft.serial_phone,
          settings,
        });
        const res = await sendMail({
          from,
          fromName: brandOf(settings),
          to: from,
          bcc: bcc.length ? bcc : undefined,
          subject: mail.subject,
          html: mail.html,
          headers: { "Auto-Submitted": "auto-generated" },
          tags: [{ name: "type", value: "doctor_form_submitted" }],
        });
        if (!res.ok) console.error("[doctor-intake] notification not sent:", res.message);
      } catch (e) {
        console.error("[doctor-intake] notification failed", e);
      }
    });

    return {
      ok: true,
      message: "ধন্যবাদ। আপনার দেওয়া তথ্য আমরা পেয়েছি। প্রোফাইল তৈরি হয়ে গেলে আমরা জানিয়ে দেব।",
    };
  } catch (e) {
    // The link was already claimed above, so a failure here would strand the
    // client with a dead link and nothing saved. Release it so they can submit
    // again instead of having to ask for a new one.
    console.error("[doctor-intake] save failed", e);
    await db
      .execute(sql`UPDATE doctor_form_links SET submitted_at = NULL WHERE id = ${link.id}`)
      .catch(() => {});
    return {
      ok: false,
      message: "তথ্য সংরক্ষণ করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    };
  }
}
