"use server";

import { z } from "zod";
import { and, eq, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db, areas, districts, hospitals, specialties } from "@/db";
import type { ML } from "@/lib/utils";
import { requireSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { revalidatePublic } from "@/lib/revalidate";
import { slugify, nextAvailableSlug } from "@/lib/slugify";
import {
  fillSpecialtyBlanks,
  fillDistrictBlanks,
  fillAreaBlanks,
  fillHospitalBlanks,
} from "@/lib/seo-defaults";

// "Quick create" endpoints for the inline modals on the doctor form.
// Each takes the minimum bilingual name and returns the new row so the caller
// can drop it straight into a searchable-select without a refetch.
//
// Guarantees:
//   • auth check
//   • Bangla name required, English optional
//   • an existing row with the same name is REUSED, never duplicated
//   • unique slug (retry with timestamp suffix on collision)
//   • public cache tags invalidated so the entity shows up on next page load

// Both languages required — English powers URLs, search matching, and the
// English site. A Bangla-only entry would silently disappear on /en/*.
//
// `source` is the /admin panel whose form opened the modal (e.g. "doctors" when
// a hospital is added from the doctor form). It only drives notifications: the
// owning panel gets a badge because the row appeared in its list without anyone
// visiting it. When source === the created entity's own panel, notify() skips.
const mlSchema = z.object({
  bn: z.string().min(1, "বাংলা নাম দিন"),
  en: z.string().min(1, "English name required"),
  source: z.string().max(40).optional(),
});

// Notification bodies below carry only detail the title lacks. The "added from
// the doctor form" part is rendered from the stored `source` by the bell, so
// repeating it here would print it twice.

export type QuickCreated = { id: number; slug: string; name_bn: string; name_en: string };
export type QuickCreateResult =
  // `existed: true` means nothing was inserted — the caller got back a row that
  // was already in the database.
  | { ok: true; row: QuickCreated; existed?: boolean }
  | { ok: false; message: string };

// `checker(slug)` returns true when the slug is FREE; invert for
// nextAvailableSlug which expects an `isTaken` predicate.
async function uniqueSlug(base: string, checker: (slug: string) => Promise<boolean>) {
  if (await checker(base)) return base;
  return nextAvailableSlug(base, async (c) => !(await checker(c)));
}

// Matches an existing row by EITHER language's name, case- and whitespace-
// insensitively. Typing a name the site already has must select that row, not
// mint a near-duplicate with a "-2" slug — duplicated taxonomy splits doctors
// across two identical districts / specialties and is invisible until it hurts.
//
// Deliberately ignores `active`: a deactivated row still occupies the name, and
// reusing it (then re-activating from its own panel) beats a second copy.
// Both sides are trimmed: callers already trim, but a predicate that only
// normalises one side is a trap for the next caller that doesn't.
function sameName(col: AnyPgColumn, name: { bn: string; en: string }) {
  return or(
    sql`lower(trim(${col}->>'bn')) = lower(trim(${name.bn}))`,
    sql`lower(trim(${col}->>'en')) = lower(trim(${name.en}))`
  );
}

// A reused row is not news: no audit entry, no notification, no cache purge,
// because the database did not change.
function reused(row: { id: number; slug: string; name: ML }): QuickCreateResult {
  return {
    ok: true,
    existed: true,
    row: { id: row.id, slug: row.slug, name_bn: row.name?.bn ?? "", name_en: row.name?.en ?? "" },
  };
}

export async function quickCreateHospital(payload: unknown): Promise<QuickCreateResult> {
  await requireSession();
  const parsed = mlSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "যাচাই ব্যর্থ" };
  const name = { bn: parsed.data.bn.trim(), en: parsed.data.en.trim() };

  const [dupe] = await db
    .select({ id: hospitals.id, slug: hospitals.slug, name: hospitals.name })
    .from(hospitals)
    .where(sameName(hospitals.name, name))
    .limit(1);
  if (dupe) return reused(dupe);

  const base = slugify(name.en || name.bn);
  const slug = await uniqueSlug(base, async (s) => {
    const [r] = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.slug, s)).limit(1);
    return !r;
  });

  // Same SEO auto-fill the full hospital form uses, so inline-created rows
  // ship with the bilingual meta_title / meta_description templates instead
  // of empty strings. `description` is left blank (admin will author it).
  const hospitalSeo = fillHospitalBlanks({ name });
  const [row] = await db
    .insert(hospitals)
    .values({
      slug,
      name,
      metaTitle: hospitalSeo.meta_title,
      metaDescription: hospitalSeo.meta_description,
    })
    .returning({ id: hospitals.id, slug: hospitals.slug });

  await audit("quick_create", "hospitals", row.id, { name: name.bn });
  await notify({
    panel: "hospitals",
    kind: "hospital.quick_create",
    entityId: row.id,
    title: { bn: `নতুন হাসপাতাল: ${name.bn}`, en: `New hospital: ${name.en}` },
    href: "/admin/hospitals",
    source: parsed.data.source,
  });
  revalidatePublic(["hospitals", "doctors"]);
  return { ok: true, row: { id: row.id, slug: row.slug, name_bn: name.bn, name_en: name.en } };
}

export async function quickCreateSpecialty(payload: unknown): Promise<QuickCreateResult> {
  await requireSession();
  const parsed = mlSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "যাচাই ব্যর্থ" };
  const name = { bn: parsed.data.bn.trim(), en: parsed.data.en.trim() };

  const [dupe] = await db
    .select({ id: specialties.id, slug: specialties.slug, name: specialties.name })
    .from(specialties)
    .where(sameName(specialties.name, name))
    .limit(1);
  if (dupe) return reused(dupe);

  const base = slugify(name.en || name.bn);
  const slug = await uniqueSlug(base, async (s) => {
    const [r] = await db.select({ id: specialties.id }).from(specialties).where(eq(specialties.slug, s)).limit(1);
    return !r;
  });

  // Same SEO auto-fill the full specialty form uses — no empty intro / meta
  // fields when the row is created from the doctor-form inline modal.
  const specialtySeo = fillSpecialtyBlanks({ name });
  const [row] = await db
    .insert(specialties)
    .values({
      slug,
      name,
      intro: specialtySeo.intro,
      metaTitle: specialtySeo.meta_title,
      metaDescription: specialtySeo.meta_description,
    })
    .returning({ id: specialties.id, slug: specialties.slug });

  await audit("quick_create", "specialties", row.id, { name: name.bn });
  await notify({
    panel: "specialties",
    kind: "specialty.quick_create",
    entityId: row.id,
    title: { bn: `নতুন বিভাগ: ${name.bn}`, en: `New specialty: ${name.en}` },
    href: "/admin/specialties",
    source: parsed.data.source,
  });
  revalidatePublic(["specialties", "doctors"]);
  return { ok: true, row: { id: row.id, slug: row.slug, name_bn: name.bn, name_en: name.en } };
}

export async function quickCreateDistrict(payload: unknown): Promise<QuickCreateResult> {
  await requireSession();
  const parsed = mlSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "যাচাই ব্যর্থ" };
  const name = { bn: parsed.data.bn.trim(), en: parsed.data.en.trim() };

  const [dupe] = await db
    .select({ id: districts.id, slug: districts.slug, name: districts.name })
    .from(districts)
    .where(sameName(districts.name, name))
    .limit(1);
  if (dupe) return reused(dupe);

  const base = slugify(name.en || name.bn);
  const slug = await uniqueSlug(base, async (s) => {
    const [r] = await db.select({ id: districts.id }).from(districts).where(eq(districts.slug, s)).limit(1);
    return !r;
  });

  const districtSeo = fillDistrictBlanks({ name });
  const [row] = await db
    .insert(districts)
    .values({
      slug,
      name,
      intro: districtSeo.intro,
      metaTitle: districtSeo.meta_title,
      metaDescription: districtSeo.meta_description,
    })
    .returning({ id: districts.id, slug: districts.slug });

  await audit("quick_create", "districts", row.id, { name: name.bn });
  await notify({
    panel: "districts",
    kind: "district.quick_create",
    entityId: row.id,
    title: { bn: `নতুন জেলা: ${name.bn}`, en: `New district: ${name.en}` },
    href: "/admin/districts",
    source: parsed.data.source,
  });
  revalidatePublic(["districts", "areas"]);
  return { ok: true, row: { id: row.id, slug: row.slug, name_bn: name.bn, name_en: name.en } };
}

const areaQuickSchema = mlSchema.extend({ district_id: z.coerce.number() });

export async function quickCreateArea(payload: unknown): Promise<QuickCreateResult> {
  await requireSession();
  const parsed = areaQuickSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "যাচাই ব্যর্থ" };
  const name = { bn: parsed.data.bn.trim(), en: parsed.data.en.trim() };
  const districtId = parsed.data.district_id;

  // Verify district exists so the area doesn't orphan.
  const [dist] = await db
    .select({ id: districts.id, name: districts.name })
    .from(districts)
    .where(and(eq(districts.id, districtId), eq(districts.active, true)))
    .limit(1);
  if (!dist) return { ok: false, message: "জেলা খুঁজে পাওয়া যায়নি" };

  // Scoped to the parent district on purpose — thana names repeat nationwide
  // (several districts have a "সদর"), so a global name match would silently
  // attach the doctor to another district's thana.
  const [dupe] = await db
    .select({ id: areas.id, slug: areas.slug, name: areas.name })
    .from(areas)
    .where(and(eq(areas.districtId, districtId), sameName(areas.name, name)))
    .limit(1);
  if (dupe) return reused(dupe);

  const base = slugify(name.en || name.bn);
  const slug = await uniqueSlug(base, async (s) => {
    const [r] = await db.select({ id: areas.id }).from(areas).where(eq(areas.slug, s)).limit(1);
    return !r;
  });

  const areaSeo = fillAreaBlanks({
    name,
    district: dist.name as { bn: string; en: string },
  });
  const [row] = await db
    .insert(areas)
    .values({
      slug,
      name,
      districtId,
      district: dist.name,
      intro: areaSeo.intro,
      metaTitle: areaSeo.meta_title,
      metaDescription: areaSeo.meta_description,
    })
    .returning({ id: areas.id, slug: areas.slug });

  await audit("quick_create", "areas", row.id, { name: name.bn, district_id: districtId });
  const distName = dist.name as { bn: string; en: string };
  await notify({
    panel: "areas",
    kind: "area.quick_create",
    entityId: row.id,
    title: {
      bn: `নতুন থানা / উপজেলা: ${name.bn}`,
      en: `New thana / upazila: ${name.en}`,
    },
    // District matters here — thana names repeat across districts.
    body: { bn: `জেলা: ${distName?.bn ?? ""}`, en: `District: ${distName?.en ?? ""}` },
    href: "/admin/areas",
    source: parsed.data.source,
  });
  revalidatePublic(["areas", "doctors"]);
  return { ok: true, row: { id: row.id, slug: row.slug, name_bn: name.bn, name_en: name.en } };
}
