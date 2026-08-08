"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, doctorFormLinks, doctorSubmissions } from "@/db";
import { requireSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { destroyImage } from "@/lib/storage";
import { getSettings } from "@/lib/settings";
import { sendMail } from "@/lib/mailer";
import { brandOf, doctorFormInviteEmail } from "@/lib/email-templates";
import { siteUrl } from "@/lib/seo-utils";
import { normalizeBdPhone } from "@/lib/doctor-intake";

// Admin side of the doctor intake flow: mint a one-time link, optionally email
// it, and permanently delete a submitted form.
//
// A link row is written the moment it is generated, because the URL has to be
// valid before anyone can share it. It is NOT a lead at that point and the
// dashboard list deliberately ignores it — a lead only exists once the form
// comes back (see the list query's `submitted_at IS NOT NULL` filter). The
// "discard" action exists for the case where the admin generates a link and then
// changes their mind, so an abandoned token doesn't stay live forever.

export type LinkResult =
  | { ok: true; id: number; token: string; url: string; message: string }
  | { ok: false; message: string };

export type SimpleResult = { ok: boolean; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const createSchema = z.object({
  client_name: z.string().trim().min(2, "ক্লায়েন্টের নাম দিন"),
  client_phone: z.string().trim().min(6, "ক্লায়েন্টের ফোন নম্বর দিন"),
});

// The public URL a token resolves to. Locale-neutral: this page has no /en twin.
// Not exported — a "use server" module may only export async functions, and the
// callers that need the URL get it back from createIntakeLink().
function intakeUrl(token: string): string {
  return siteUrl(`/doctor-form/${token}`);
}

export async function createIntakeLink(input: unknown): Promise<LinkResult> {
  const session = await requireSession();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ হয়েছে" };
  }

  // 24 random bytes → 32 URL-safe characters. This token is the only thing
  // standing between the form and the open internet, so it is generated with
  // node:crypto and never derived from anything guessable (no ids, no time).
  const token = randomBytes(24).toString("base64url");

  const [row] = await db
    .insert(doctorFormLinks)
    .values({
      token,
      clientName: parsed.data.client_name,
      clientPhone: normalizeBdPhone(parsed.data.client_phone) || parsed.data.client_phone,
      createdBy: session.name,
    })
    .returning({ id: doctorFormLinks.id });

  await audit("create", "doctor_form_links", row.id, { client: parsed.data.client_name });
  return { ok: true, id: row.id, token, url: intakeUrl(token), message: "লিংক তৈরি হয়েছে" };
}

const sendSchema = z.object({
  id: z.coerce.number().int().positive(),
  to_email: z.string().trim().min(3),
  from_email: z.string().trim().default(""),
});

/**
 * Emails an already-generated link. Sending is a separate step from generating
 * on purpose: plenty of clients get their link over WhatsApp instead, and that
 * path must not require an email address at all.
 */
export async function sendIntakeLink(input: unknown): Promise<SimpleResult> {
  await requireSession();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "ইমেইল ঠিকানা দিন" };
  const { id, to_email } = parsed.data;

  const to = to_email.toLowerCase();
  if (!EMAIL_RE.test(to)) return { ok: false, message: "সঠিক ইমেইল ঠিকানা দিন" };

  const [link] = await db
    .select({
      id: doctorFormLinks.id,
      token: doctorFormLinks.token,
      clientName: doctorFormLinks.clientName,
      submittedAt: doctorFormLinks.submittedAt,
    })
    .from(doctorFormLinks)
    .where(eq(doctorFormLinks.id, id))
    .limit(1);
  if (!link) return { ok: false, message: "লিংক খুঁজে পাওয়া যায়নি" };
  if (link.submittedAt) return { ok: false, message: "এই লিংক থেকে ফর্ম ইতিমধ্যে জমা পড়েছে" };

  const settings = await getSettings();
  const from = parsed.data.from_email.trim() || settings.contact_email_from?.trim() || "contact@doctorsfindbd.com";
  if (!EMAIL_RE.test(from)) return { ok: false, message: "প্রেরকের ইমেইল ঠিকভাবে লিখুন" };

  const mail = doctorFormInviteEmail({
    clientName: link.clientName,
    formUrl: intakeUrl(link.token),
    settings,
  });

  const res = await sendMail({
    from,
    fromName: brandOf(settings),
    to,
    replyTo: from,
    subject: mail.subject,
    html: mail.html,
    tags: [{ name: "type", value: "doctor_form_invite" }],
  });
  if (!res.ok) return { ok: false, message: res.message };

  await db
    .update(doctorFormLinks)
    .set({ clientEmail: to, fromEmail: from, sentAt: new Date() })
    .where(eq(doctorFormLinks.id, id));

  await audit("update", "doctor_form_links", id, { sent_to: to });
  return { ok: true, message: `ইমেইল পাঠানো হয়েছে: ${to}` };
}

/**
 * Throws away a link the admin generated but decided not to use. Only ever
 * touches links that were never submitted, so it can't destroy a lead.
 */
export async function discardIntakeLink(id: number): Promise<SimpleResult> {
  await requireSession();
  const res = await db.execute<{ id: number }>(sql`
    DELETE FROM doctor_form_links
     WHERE id = ${Number(id)} AND submitted_at IS NULL
    RETURNING id
  `);
  if (!res.rows[0]) return { ok: false, message: "লিংকটি বাতিল করা যায়নি" };
  return { ok: true, message: "লিংক বাতিল হয়েছে" };
}

/**
 * Permanent delete of one submitted form: the R2 images go first, then the row
 * and its link (FK cascade) leave the database entirely. There is no soft
 * delete and nothing to restore — that is the requested behaviour, so the UI
 * confirms before calling this.
 */
export async function deleteDoctorSubmission(id: number): Promise<SimpleResult> {
  await requireSession();
  const submissionId = Number(id);
  if (!Number.isFinite(submissionId)) return { ok: false, message: "ভুল আইডি" };

  const [row] = await db
    .select({
      id: doctorSubmissions.id,
      linkId: doctorSubmissions.linkId,
      photoKey: doctorSubmissions.photoKey,
      clientName: doctorSubmissions.clientName,
      doctorNameBn: doctorSubmissions.doctorNameBn,
    })
    .from(doctorSubmissions)
    .where(eq(doctorSubmissions.id, submissionId))
    .limit(1);
  if (!row) return { ok: false, message: "ফর্মটি খুঁজে পাওয়া যায়নি" };

  await destroyImage(row.photoKey);
  await db.delete(doctorSubmissions).where(eq(doctorSubmissions.id, submissionId));
  // The link row is the other half of the same lead; with the submission gone it
  // has no purpose, and it must not become reusable either.
  if (row.linkId) await db.delete(doctorFormLinks).where(eq(doctorFormLinks.id, row.linkId));

  await audit("delete", "doctor_submissions", submissionId, {
    client: row.clientName,
    doctor: row.doctorNameBn,
  });
  return { ok: true, message: "ফর্মটি সম্পূর্ণভাবে মুছে ফেলা হয়েছে" };
}
