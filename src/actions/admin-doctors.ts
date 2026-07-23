"use server";

import { z } from "zod";
import { and, eq, ne, notInArray } from "drizzle-orm";
import { db, chambers, doctorSpecialties, doctors } from "@/db";
import { requireSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { revalidatePublic } from "@/lib/revalidate";
import { uploadImage, destroyImage } from "@/lib/storage";
import { slugify } from "@/lib/slugify";
import { recordSlugChange } from "@/lib/seo";
import { sanitizeHtml } from "@/lib/sanitize";
import { parseLatLng } from "@/lib/map-coords";

export type ActionResult = { ok: boolean; message: string; id?: number };

// Multilingual JSONB value from the admin form: Bangla required, English optional.
const mlSchema = z.object({ bn: z.string().default(""), en: z.string().default("") });
const mlRequired = z.object({ bn: z.string().min(1), en: z.string().default("") });

// Admins may paste any of these forms into the map field:
//   • bare URL:               https://www.google.com/maps/embed?pb=...
//   • full iframe tag:        <iframe src="https://..." width="600" ...></iframe>
//   • Google share link:      https://maps.app.goo.gl/...
// This unwraps the iframe form to just the src URL so downstream code sees one
// consistent shape. Non-http strings (and empty) become empty string.
function extractMapUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  // <iframe ... src="..."> or src='...'
  const iframeMatch = s.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  if (iframeMatch) return iframeMatch[1].trim();
  // Bare URL — only accept http(s) so we don't store scripts / javascript: etc.
  if (/^https?:\/\//i.test(s)) return s;
  return "";
}

const chamberSchema = z.object({
  id: z.number().optional(),
  name: mlRequired,
  address: mlSchema,
  area_id: z.coerce.number().nullable().optional(),
  fee: z.coerce.number().min(0).default(0),
  phone: z.string().optional().default(""),
  map_url: z.string().optional().default("").transform(extractMapUrl),
  // Public-visibility toggle; new chambers default OFF so admins can finish
  // filling in details before exposing them.
  visible: z.boolean().default(false),
  // Coords override — if admin edited them by hand we keep those. When null,
  // the save handler tries to auto-extract them from the map URL below.
  lat: z.coerce.number().nullable().optional(),
  lng: z.coerce.number().nullable().optional(),
  schedule: z.array(z.object({ days: mlSchema, time: mlSchema })).default([]),
});

const doctorSchema = z.object({
  id: z.coerce.number().optional(),
  name: z.object({ bn: z.string().min(2, "ডাক্তারের বাংলা নাম দিন"), en: z.string().default("") }),
  slug: z.string().optional(),
  degrees: mlSchema,
  bio: mlSchema,
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  experience_years: z.coerce.number().nullable().optional(),
  patients_served: mlSchema,
  hospital_id: z.coerce.number().nullable().optional(),
  verified: z.boolean().default(false),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  meta_title: mlSchema,
  meta_description: mlSchema,
  // Verified social profiles → JSON-LD sameAs. Empty strings are allowed at
  // input (form always sends the field) but stripped out below; only real
  // https URLs survive to the DB, so nothing garbage leaks into schema.org.
  social_links: z.object({
    website: z.string().optional().default(""),
    linkedin: z.string().optional().default(""),
    facebook: z.string().optional().default(""),
    twitter: z.string().optional().default(""),
    instagram: z.string().optional().default(""),
    youtube: z.string().optional().default(""),
    researchgate: z.string().optional().default(""),
  }).default({}),
  specialty_ids: z.array(z.number()).default([]),
  chambers: z.array(chamberSchema).default([]),
  photo_data: z.string().optional(),
  remove_photo: z.boolean().default(false),
});

// Keep only valid https(s) URLs; drop empty and malformed entries so JSON-LD
// stays clean and the DB doesn't hoard broken links.
function cleanSocialLinks(input: {
  website?: string; linkedin?: string; facebook?: string; twitter?: string;
  instagram?: string; youtube?: string; researchgate?: string;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    const url = (v || "").trim();
    if (url && /^https?:\/\//i.test(url)) out[k] = url;
  }
  return out;
}

export async function saveDoctor(payload: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = doctorSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ হয়েছে" };
  }
  const doc = parsed.data;
  // Bio arrives as HTML from the rich-text editor; strip anything unsafe before storing.
  doc.bio = { bn: sanitizeHtml(doc.bio.bn), en: sanitizeHtml(doc.bio.en) };

  const existing = doc.id
    ? (await db
        .select({ id: doctors.id, slug: doctors.slug, photoKey: doctors.photoKey })
        .from(doctors)
        .where(eq(doctors.id, doc.id))
        .limit(1))[0] ?? null
    : null;
  if (doc.id && !existing) return { ok: false, message: "ডাক্তার খুঁজে পাওয়া যায়নি" };

  // Slug: prefer English name for clean URLs, fall back to Bangla.
  let slug = doc.slug?.trim()
    ? slugify(doc.slug)
    : existing?.slug || slugify(doc.name.en || doc.name.bn);
  const [clash] = await db
    .select({ id: doctors.id })
    .from(doctors)
    .where(and(eq(doctors.slug, slug), doc.id ? ne(doctors.id, doc.id) : undefined))
    .limit(1);
  if (clash) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  // Photo pipeline: replacing always destroys the previous R2 object first.
  let photo_key = existing?.photoKey ?? null;
  let photo_url: string | null = null;
  let photoChanged = false;
  if (doc.remove_photo && photo_key) {
    await destroyImage(photo_key);
    photo_key = null;
    photoChanged = true;
  } else if (doc.photo_data?.startsWith("data:image")) {
    const up = await uploadImage(doc.photo_data, "doctors", photo_key);
    photo_key = up.key;
    photo_url = up.url;
    photoChanged = true;
  }

  let doctorId: number;
  if (existing) {
    const patch: Partial<typeof doctors.$inferInsert> = {
      slug,
      name: doc.name,
      degrees: doc.degrees,
      bio: doc.bio,
      gender: doc.gender ?? null,
      experienceYears: doc.experience_years ?? null,
      patientsServed: doc.patients_served,
      hospitalId: doc.hospital_id ?? null,
      verified: doc.verified,
      featured: doc.featured,
      active: doc.active,
      metaTitle: doc.meta_title,
      metaDescription: doc.meta_description,
      socialLinks: cleanSocialLinks(doc.social_links),
      updatedAt: new Date(),
    };
    if (photoChanged) { patch.photoKey = photo_key; patch.photoUrl = photo_url; }
    await db.update(doctors).set(patch).where(eq(doctors.id, existing.id));
    doctorId = existing.id;
    if (existing.slug !== slug) {
      await recordSlugChange(`/doctors/${existing.slug}`, `/doctors/${slug}`);
    }
  } else {
    const [row] = await db
      .insert(doctors)
      .values({
        slug,
        name: doc.name,
        degrees: doc.degrees,
        bio: doc.bio,
        gender: doc.gender ?? null,
        experienceYears: doc.experience_years ?? null,
        patientsServed: doc.patients_served,
        hospitalId: doc.hospital_id ?? null,
        verified: doc.verified,
        featured: doc.featured,
        active: doc.active,
        metaTitle: doc.meta_title,
        metaDescription: doc.meta_description,
        socialLinks: cleanSocialLinks(doc.social_links),
        photoKey: photo_key,
        photoUrl: photo_url,
      })
      .returning({ id: doctors.id });
    doctorId = row.id;
  }

  // Specialties join table.
  await db.delete(doctorSpecialties).where(eq(doctorSpecialties.doctorId, doctorId));
  if (doc.specialty_ids.length > 0) {
    await db
      .insert(doctorSpecialties)
      .values(doc.specialty_ids.map((sid, i) => ({ doctorId, specialtyId: sid, isPrimary: i === 0 })))
      .onConflictDoNothing();
  }

  // Chambers: upsert given ones, delete removed ones.
  const keepIds: number[] = [];
  for (let i = 0; i < doc.chambers.length; i++) {
    const c = doc.chambers[i];
    const mapUrl = c.map_url?.trim() || null;
    // Server-side coord fallback: if admin left lat/lng blank but the map URL
    // has them, extract now so the DB row is complete. Manual edits win.
    const parsed = mapUrl ? parseLatLng(mapUrl) : null;
    const lat = c.lat ?? parsed?.lat ?? null;
    const lng = c.lng ?? parsed?.lng ?? null;
    if (c.id) {
      await db
        .update(chambers)
        .set({
          name: c.name,
          address: c.address,
          areaId: c.area_id || null,
          fee: c.fee,
          phone: c.phone || null,
          mapUrl,
          lat,
          lng,
          visible: c.visible,
          schedule: c.schedule,
          sort: i,
        })
        .where(and(eq(chambers.id, c.id), eq(chambers.doctorId, doctorId)));
      keepIds.push(c.id);
    } else {
      const [row] = await db
        .insert(chambers)
        .values({
          doctorId,
          name: c.name,
          address: c.address,
          areaId: c.area_id || null,
          fee: c.fee,
          phone: c.phone || null,
          mapUrl,
          lat,
          lng,
          visible: c.visible,
          schedule: c.schedule,
          sort: i,
        })
        .returning({ id: chambers.id });
      keepIds.push(row.id);
    }
  }
  if (keepIds.length > 0) {
    await db.delete(chambers).where(and(eq(chambers.doctorId, doctorId), notInArray(chambers.id, keepIds)));
  } else {
    await db.delete(chambers).where(eq(chambers.doctorId, doctorId));
  }

  await audit(existing ? "update" : "create", "doctors", doctorId, { name: doc.name.bn, slug });
  revalidatePublic(["doctors", "specialties", "areas", "hospitals"]);
  return { ok: true, message: existing ? "ডাক্তারের তথ্য আপডেট হয়েছে" : "নতুন ডাক্তার যুক্ত হয়েছে", id: doctorId };
}

export async function deleteDoctor(id: number): Promise<ActionResult> {
  await requireSession();
  const [doc] = await db
    .select({ photoKey: doctors.photoKey, name: doctors.name })
    .from(doctors)
    .where(eq(doctors.id, id))
    .limit(1);
  if (!doc) return { ok: false, message: "ডাক্তার খুঁজে পাওয়া যায়নি" };
  await destroyImage(doc.photoKey);
  await db.delete(doctors).where(eq(doctors.id, id));
  await audit("delete", "doctors", id, { name: doc.name?.bn });
  revalidatePublic(["doctors", "specialties", "areas", "hospitals"]);
  return { ok: true, message: "ডাক্তার মুছে ফেলা হয়েছে" };
}

import { type DoctorInitial } from "@/app/admin/doctors/doctor-form";
import { type SocialLinksDraft, toML, EMPTY_SOCIAL_LINKS } from "@/lib/utils";
import { sql } from "drizzle-orm";

export async function getDoctor(id: number): Promise<DoctorInitial | null> {
  const doctorId = Number(id);
  if (!Number.isFinite(doctorId)) return null;

  type MLRaw = { bn?: string; en?: string } | null;

  const { rows: docRows } = await db.execute<{
    id: number; slug: string; name: MLRaw; degrees: MLRaw; bio: MLRaw;
    gender: string | null; experience_years: number | null; patients_served: MLRaw;
    hospital_id: number | null;
    verified: boolean; featured: boolean; active: boolean;
    meta_title: MLRaw; meta_description: MLRaw; photo_url: string | null;
    social_links: Partial<SocialLinksDraft> | null;
  }>(sql`SELECT * FROM doctors WHERE id=${doctorId}`);
  const doc = docRows[0];
  if (!doc) return null;

  const [specialtyIdsRes, chambersRes] = await Promise.all([
    db.execute<{ specialty_id: number }>(
      sql`SELECT specialty_id FROM doctor_specialties WHERE doctor_id=${doctorId} ORDER BY is_primary DESC`
    ),
    db.execute<{
      id: number; name: MLRaw; address: MLRaw; area_id: number | null; district_id: number | null;
      fee: number; phone: string | null; map_url: string | null;
      visible: boolean; lat: number | null; lng: number | null;
      schedule: { days: MLRaw; time: MLRaw }[];
    }>(sql`
      SELECT c.id, c.name, c.address, c.area_id, a.district_id,
        c.fee, c.phone, c.map_url, c.visible, c.lat, c.lng, c.schedule
      FROM chambers c LEFT JOIN areas a ON a.id = c.area_id
      WHERE c.doctor_id=${doctorId} ORDER BY c.sort
    `),
  ]);

  const initial: DoctorInitial = {
    id: doc.id,
    name: toML(doc.name),
    slug: doc.slug,
    degrees: toML(doc.degrees),
    bio: toML(doc.bio),
    gender: doc.gender,
    experience_years: doc.experience_years,
    patients_served: toML(doc.patients_served),
    hospital_id: doc.hospital_id ?? null,
    verified: doc.verified,
    featured: doc.featured,
    active: doc.active,
    meta_title: toML(doc.meta_title),
    meta_description: toML(doc.meta_description),
    photo_url: doc.photo_url,
    social_links: { ...EMPTY_SOCIAL_LINKS(), ...(doc.social_links || {}) },
    specialty_ids: specialtyIdsRes.rows.map((r) => r.specialty_id),
    chambers: chambersRes.rows.map((c) => ({
      id: c.id,
      name: toML(c.name),
      address: toML(c.address),
      district_id: c.district_id,
      area_id: c.area_id,
      fee: c.fee,
      phone: c.phone || "",
      map_url: c.map_url || "",
      visible: c.visible,
      lat: c.lat,
      lng: c.lng,
      schedule:
        Array.isArray(c.schedule) && c.schedule.length > 0
          ? c.schedule.map((s) => ({ days: toML(s.days), time: toML(s.time) }))
          : [],
    })),
  };

  return initial;
}

