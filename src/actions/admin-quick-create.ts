"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, areas, districts, hospitals, specialties } from "@/db";
import { requireSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
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
//   • unique slug (retry with timestamp suffix on collision)
//   • public cache tags invalidated so the entity shows up on next page load

// Both languages required — English powers URLs, search matching, and the
// English site. A Bangla-only entry would silently disappear on /en/*.
const mlSchema = z.object({
  bn: z.string().min(1, "বাংলা নাম দিন"),
  en: z.string().min(1, "English name required"),
});

export type QuickCreated = { id: number; slug: string; name_bn: string; name_en: string };
export type QuickCreateResult = { ok: true; row: QuickCreated } | { ok: false; message: string };

// `checker(slug)` returns true when the slug is FREE; invert for
// nextAvailableSlug which expects an `isTaken` predicate.
async function uniqueSlug(base: string, checker: (slug: string) => Promise<boolean>) {
  if (await checker(base)) return base;
  return nextAvailableSlug(base, async (c) => !(await checker(c)));
}

export async function quickCreateHospital(payload: unknown): Promise<QuickCreateResult> {
  await requireSession();
  const parsed = mlSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "যাচাই ব্যর্থ" };
  const name = { bn: parsed.data.bn.trim(), en: parsed.data.en.trim() };

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
  revalidatePublic(["hospitals", "doctors"]);
  return { ok: true, row: { id: row.id, slug: row.slug, name_bn: name.bn, name_en: name.en } };
}

export async function quickCreateSpecialty(payload: unknown): Promise<QuickCreateResult> {
  await requireSession();
  const parsed = mlSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "যাচাই ব্যর্থ" };
  const name = { bn: parsed.data.bn.trim(), en: parsed.data.en.trim() };

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
  revalidatePublic(["specialties", "doctors"]);
  return { ok: true, row: { id: row.id, slug: row.slug, name_bn: name.bn, name_en: name.en } };
}

export async function quickCreateDistrict(payload: unknown): Promise<QuickCreateResult> {
  await requireSession();
  const parsed = mlSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "যাচাই ব্যর্থ" };
  const name = { bn: parsed.data.bn.trim(), en: parsed.data.en.trim() };

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
  revalidatePublic(["areas", "doctors"]);
  return { ok: true, row: { id: row.id, slug: row.slug, name_bn: name.bn, name_en: name.en } };
}
