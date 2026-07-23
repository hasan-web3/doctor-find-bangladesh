"use server";

import { z } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  db,
  areas,
  blogCategories,
  blogPosts,
  districts,
  faqs,
  heroSlides,
  hospitals,
  reviews,
  specialties,
  testimonials,
} from "@/db";
import { requireSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { revalidatePublic } from "@/lib/revalidate";
import { uploadImage, destroyImage } from "@/lib/storage";
import { slugify } from "@/lib/slugify";
import { recordSlugChange } from "@/lib/seo";
import type { ActionResult } from "./admin-doctors";

import { type PostInitial } from "@/app/admin/blog/post-form";
import { toML } from "@/lib/utils";

const mlSchema = z.object({ bn: z.string().default(""), en: z.string().default("") });
const mlRequired = (message: string) => z.object({ bn: z.string().min(1, message), en: z.string().default("") });

// Slug-clash check: is another row (id != current) already using this slug?
const idNe = <T extends { id: unknown }>(col: T["id"], id: number | undefined) =>
  id ? ne(col as never, id) : undefined;

// ---------------- specialties ----------------
const specialtySchema = z.object({
  id: z.coerce.number().optional(),
  slug: z.string().optional(),
  name: mlRequired("বিভাগের বাংলা নাম দিন"),
  icon: z.string().default("activity"),
  tint: z.coerce.number().default(0),
  intro: mlSchema,
  meta_title: mlSchema,
  meta_description: mlSchema,
  active: z.boolean().default(true),
  sort: z.coerce.number().default(0),
});

export async function saveSpecialty(payload: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = specialtySchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ" };
  const s = parsed.data;

  const existing = s.id
    ? (await db.select({ id: specialties.id, slug: specialties.slug }).from(specialties).where(eq(specialties.id, s.id)).limit(1))[0] ?? null
    : null;
  let slug = s.slug?.trim() ? slugify(s.slug) : existing?.slug || slugify(s.name.en || s.name.bn);
  const [clash] = await db
    .select({ id: specialties.id })
    .from(specialties)
    .where(and(eq(specialties.slug, slug), idNe(specialties.id, s.id)))
    .limit(1);
  if (clash) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  if (existing) {
    await db
      .update(specialties)
      .set({
        slug, name: s.name, icon: s.icon, tint: s.tint, intro: s.intro,
        metaTitle: s.meta_title, metaDescription: s.meta_description,
        active: s.active, sort: s.sort, updatedAt: new Date(),
      })
      .where(eq(specialties.id, existing.id));
    if (existing.slug !== slug) await recordSlugChange(`/specialties/${existing.slug}`, `/specialties/${slug}`);
  } else {
    await db.insert(specialties).values({
      slug, name: s.name, icon: s.icon, tint: s.tint, intro: s.intro,
      metaTitle: s.meta_title, metaDescription: s.meta_description,
      active: s.active, sort: s.sort,
    });
  }
  await audit(existing ? "update" : "create", "specialties", s.id, { name: s.name.bn });
  revalidatePublic(["specialties", "redirects"]);
  return { ok: true, message: "বিভাগ সংরক্ষণ হয়েছে" };
}

export async function deleteSpecialty(id: number): Promise<ActionResult> {
  await requireSession();
  await db.delete(specialties).where(eq(specialties.id, id));
  await audit("delete", "specialties", id);
  revalidatePublic(["specialties"]);
  return { ok: true, message: "বিভাগ মুছে ফেলা হয়েছে" };
}

// ---------------- districts ----------------
const districtSchema = z.object({
  id: z.coerce.number().optional(),
  slug: z.string().optional(),
  name: mlRequired("জেলার বাংলা নাম দিন"),
  lat: z.coerce.number().nullable().optional(),
  lng: z.coerce.number().nullable().optional(),
  intro: mlSchema,
  meta_title: mlSchema,
  meta_description: mlSchema,
  active: z.boolean().default(true),
  sort: z.coerce.number().default(0),
});

export async function saveDistrict(payload: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = districtSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ" };
  const d = parsed.data;

  const existing = d.id
    ? (await db.select({ id: districts.id, slug: districts.slug }).from(districts).where(eq(districts.id, d.id)).limit(1))[0] ?? null
    : null;
  let slug = d.slug?.trim() ? slugify(d.slug) : existing?.slug || slugify(d.name.en || d.name.bn);
  const [clash] = await db.select({ id: districts.id }).from(districts).where(and(eq(districts.slug, slug), idNe(districts.id, d.id))).limit(1);
  if (clash) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  if (existing) {
    await db
      .update(districts)
      .set({
        slug, name: d.name, lat: d.lat ?? null, lng: d.lng ?? null,
        intro: d.intro, metaTitle: d.meta_title, metaDescription: d.meta_description,
        active: d.active, sort: d.sort, updatedAt: new Date(),
      })
      .where(eq(districts.id, existing.id));
  } else {
    await db.insert(districts).values({
      slug, name: d.name, lat: d.lat ?? null, lng: d.lng ?? null,
      intro: d.intro, metaTitle: d.meta_title, metaDescription: d.meta_description,
      active: d.active, sort: d.sort,
    });
  }
  await audit(existing ? "update" : "create", "districts", d.id, { name: d.name.bn });
  revalidatePublic(["districts", "areas"]);
  return { ok: true, message: "জেলা সংরক্ষণ হয়েছে" };
}

export async function deleteDistrict(id: number): Promise<ActionResult> {
  await requireSession();
  await db.delete(districts).where(eq(districts.id, id));
  await audit("delete", "districts", id);
  revalidatePublic(["districts", "areas"]);
  return { ok: true, message: "জেলা মুছে ফেলা হয়েছে" };
}

// ---------------- areas ----------------
const areaSchema = z.object({
  id: z.coerce.number().optional(),
  slug: z.string().optional(),
  name: mlRequired("থানা / উপজেলার বাংলা নাম দিন"),
  district_id: z.coerce.number({ message: "জেলা নির্বাচন করুন" }),
  lat: z.coerce.number().nullable().optional(),
  lng: z.coerce.number().nullable().optional(),
  intro: mlSchema,
  meta_title: mlSchema,
  meta_description: mlSchema,
  active: z.boolean().default(true),
  sort: z.coerce.number().default(0),
});

export async function saveArea(payload: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = areaSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ" };
  const a = parsed.data;

  // Verify the district exists — also mirror its JSONB name into the area row
  // so legacy code that still reads areas.district keeps working.
  const [dist] = await db
    .select({ id: districts.id, name: districts.name, slug: districts.slug })
    .from(districts)
    .where(eq(districts.id, a.district_id))
    .limit(1);
  if (!dist) return { ok: false, message: "জেলা খুঁজে পাওয়া যায়নি" };

  const existing = a.id
    ? (await db
        .select({ id: areas.id, slug: areas.slug, districtId: areas.districtId })
        .from(areas).where(eq(areas.id, a.id)).limit(1)
      )[0] ?? null
    : null;
  let slug = a.slug?.trim() ? slugify(a.slug) : existing?.slug || slugify(a.name.en || a.name.bn);
  const [clash] = await db.select({ id: areas.id }).from(areas).where(and(eq(areas.slug, slug), idNe(areas.id, a.id))).limit(1);
  if (clash) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  if (existing) {
    const [oldDist] = existing.districtId ? await db.select({slug: districts.slug}).from(districts).where(eq(districts.id, existing.districtId)) : [null];
    
    await db
      .update(areas)
      .set({
        slug, name: a.name, districtId: a.district_id, district: dist.name,
        lat: a.lat ?? null, lng: a.lng ?? null,
        intro: a.intro, metaTitle: a.meta_title, metaDescription: a.meta_description,
        active: a.active, sort: a.sort, updatedAt: new Date(),
      })
      .where(eq(areas.id, existing.id));
    if (existing.slug !== slug && oldDist?.slug) {
      await recordSlugChange(`/area/doctors/${oldDist.slug}/${existing.slug}`, `/area/doctors/${dist.slug}/${slug}`);
    }
  } else {
    await db.insert(areas).values({
      slug, name: a.name, districtId: a.district_id, district: dist.name,
      lat: a.lat ?? null, lng: a.lng ?? null,
      intro: a.intro, metaTitle: a.meta_title, metaDescription: a.meta_description,
      active: a.active, sort: a.sort,
    });
  }
  await audit(existing ? "update" : "create", "areas", a.id, { name: a.name.bn });
  revalidatePublic(["areas", "redirects"]);
  return { ok: true, message: "থানা / উপজেলা সংরক্ষণ হয়েছে" };
}

export async function deleteArea(id: number): Promise<ActionResult> {
  await requireSession();
  await db.delete(areas).where(eq(areas.id, id));
  await audit("delete", "areas", id);
  revalidatePublic(["areas"]);
  return { ok: true, message: "থানা / উপজেলা মুছে ফেলা হয়েছে" };
}

// ---------------- hospitals ----------------
// Same iframe-vs-URL smart extraction as chambers use.
function extractMapUrlHospital(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const m = s.match(/<iframe[^>]*\s+src\s*=\s*["']([^"']+)["']/i);
  if (m) return m[1].trim();
  if (/^https?:\/\//i.test(s)) return s;
  return "";
}

const hospitalSchema = z.object({
  id: z.coerce.number().optional(),
  slug: z.string().optional(),
  name: mlRequired("হাসপাতালের বাংলা নাম দিন"),
  area_id: z.coerce.number().nullable().optional(),
  address: mlSchema,
  phone: z.string().optional().default(""),
  lat: z.coerce.number().nullable().optional(),
  lng: z.coerce.number().nullable().optional(),
  description: mlSchema,
  departments: z.array(mlSchema).default([]),
  map_url: z.string().optional().default("").transform(extractMapUrlHospital),
  meta_title: mlSchema,
  meta_description: mlSchema,
  active: z.boolean().default(true),
  image_data: z.string().optional(),
  remove_image: z.boolean().default(false),
  gallery_add: z.array(z.string()).default([]),
  gallery_remove: z.array(z.string()).default([]),
});

export async function saveHospital(payload: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = hospitalSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ" };
  const h = parsed.data;
  // Description arrives as HTML from the rich text editor — strip anything
  // unsafe (scripts, event handlers, iframes) before it hits the DB.
  h.description = { bn: sanitizeHtml(h.description.bn), en: sanitizeHtml(h.description.en) };

  const existing = h.id
    ? (await db
        .select({ id: hospitals.id, slug: hospitals.slug, imageKey: hospitals.imageKey, gallery: hospitals.gallery })
        .from(hospitals)
        .where(eq(hospitals.id, h.id))
        .limit(1))[0] ?? null
    : null;
  let slug = h.slug?.trim() ? slugify(h.slug) : existing?.slug || slugify(h.name.en || h.name.bn);
  const [clash] = await db.select({ id: hospitals.id }).from(hospitals).where(and(eq(hospitals.slug, slug), idNe(hospitals.id, h.id))).limit(1);
  if (clash) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  let image_key = existing?.imageKey ?? null;
  let image_url: string | null = null;
  let imageChanged = false;
  if (h.remove_image && image_key) {
    await destroyImage(image_key);
    image_key = null;
    imageChanged = true;
  } else if (h.image_data?.startsWith("data:image")) {
    const up = await uploadImage(h.image_data, "hospitals", image_key);
    image_key = up.key;
    image_url = up.url;
    imageChanged = true;
  }

  let gallery = existing?.gallery ?? [];
  for (const key of h.gallery_remove) {
    await destroyImage(key);
    gallery = gallery.filter((g) => g.key !== key);
  }
  for (const dataUrl of h.gallery_add) {
    if (dataUrl.startsWith("data:image")) {
      const up = await uploadImage(dataUrl, "hospitals/gallery");
      gallery.push({ key: up.key, url: up.url });
    }
  }

  if (existing) {
    const patch: Partial<typeof hospitals.$inferInsert> = {
      slug, name: h.name, areaId: h.area_id || null, address: h.address, phone: h.phone || null,
      lat: h.lat ?? null, lng: h.lng ?? null, description: h.description, departments: h.departments,
      mapUrl: h.map_url || null,
      metaTitle: h.meta_title, metaDescription: h.meta_description, active: h.active,
      gallery, updatedAt: new Date(),
    };
    if (imageChanged) { patch.imageKey = image_key; patch.imageUrl = image_url; }
    await db.update(hospitals).set(patch).where(eq(hospitals.id, existing.id));
    if (existing.slug !== slug) await recordSlugChange(`/hospitals/${existing.slug}`, `/hospitals/${slug}`);
  } else {
    await db.insert(hospitals).values({
      slug, name: h.name, areaId: h.area_id || null, address: h.address, phone: h.phone || null,
      lat: h.lat ?? null, lng: h.lng ?? null, description: h.description, departments: h.departments,
      mapUrl: h.map_url || null,
      metaTitle: h.meta_title, metaDescription: h.meta_description, active: h.active,
      imageKey: image_key, imageUrl: image_url, gallery,
    });
  }
  await audit(existing ? "update" : "create", "hospitals", h.id, { name: h.name.bn });
  revalidatePublic(["hospitals", "redirects"]);
  return { ok: true, message: "হাসপাতাল সংরক্ষণ হয়েছে" };
}

export async function deleteHospital(id: number): Promise<ActionResult> {
  await requireSession();
  const [h] = await db.select({ imageKey: hospitals.imageKey, gallery: hospitals.gallery }).from(hospitals).where(eq(hospitals.id, id)).limit(1);
  if (h) {
    await destroyImage(h.imageKey);
    for (const g of h.gallery ?? []) await destroyImage(g.key);
  }
  await db.delete(hospitals).where(eq(hospitals.id, id));
  await audit("delete", "hospitals", id);
  revalidatePublic(["hospitals"]);
  return { ok: true, message: "হাসপাতাল মুছে ফেলা হয়েছে" };
}

// ---------------- blog ----------------
const postSchema = z.object({
  id: z.coerce.number().optional(),
  slug: z.string().optional(),
  title: mlRequired("বাংলা শিরোনাম দিন"),
  excerpt: mlSchema,
  content: mlSchema,
  category_id: z.coerce.number().nullable().optional(),
  published: z.boolean().default(false),
  meta_title: mlSchema,
  meta_description: mlSchema,
  cover_data: z.string().optional(),
  remove_cover: z.boolean().default(false),
});

export async function saveBlogPost(payload: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = postSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ" };
  const p = parsed.data;

  const existing = p.id
    ? (await db.select({ id: blogPosts.id, slug: blogPosts.slug, coverKey: blogPosts.coverKey }).from(blogPosts).where(eq(blogPosts.id, p.id)).limit(1))[0] ?? null
    : null;
  let slug = p.slug?.trim() ? slugify(p.slug) : existing?.slug || slugify(p.title.en || p.title.bn);
  const [clash] = await db.select({ id: blogPosts.id }).from(blogPosts).where(and(eq(blogPosts.slug, slug), idNe(blogPosts.id, p.id))).limit(1);
  if (clash) slug = `${slug}-${Date.now().toString().slice(-4)}`;

  let cover_key = existing?.coverKey ?? null;
  let cover_url: string | null = null;
  let coverChanged = false;
  if (p.remove_cover && cover_key) {
    await destroyImage(cover_key);
    cover_key = null;
    coverChanged = true;
  } else if (p.cover_data?.startsWith("data:image")) {
    const up = await uploadImage(p.cover_data, "blog", cover_key);
    cover_key = up.key;
    cover_url = up.url;
    coverChanged = true;
  }

  if (existing) {
    const patch: Partial<typeof blogPosts.$inferInsert> = {
      slug, title: p.title, excerpt: p.excerpt, content: p.content,
      categoryId: p.category_id || null, published: p.published,
      metaTitle: p.meta_title, metaDescription: p.meta_description,
      updatedAt: new Date(),
    };
    if (coverChanged) { patch.coverKey = cover_key; patch.coverUrl = cover_url; }
    await db
      .update(blogPosts)
      .set({
        ...patch,
        publishedAt: sql`CASE WHEN ${p.published} AND ${blogPosts.publishedAt} IS NULL THEN now() ELSE ${blogPosts.publishedAt} END`,
      })
      .where(eq(blogPosts.id, existing.id));
    if (existing.slug !== slug) await recordSlugChange(`/blog/${existing.slug}`, `/blog/${slug}`);
  } else {
    await db.insert(blogPosts).values({
      slug, title: p.title, excerpt: p.excerpt, content: p.content,
      categoryId: p.category_id || null, published: p.published,
      publishedAt: p.published ? new Date() : null,
      metaTitle: p.meta_title, metaDescription: p.meta_description,
      coverKey: cover_key, coverUrl: cover_url,
    });
  }
  await audit(existing ? "update" : "create", "blog_posts", p.id, { title: p.title.bn });
  revalidatePublic(["blog", "redirects"]);
  return { ok: true, message: "আর্টিকেল সংরক্ষণ হয়েছে" };
}

export async function deleteBlogPost(id: number): Promise<ActionResult> {
  await requireSession();
  const [p] = await db.select({ coverKey: blogPosts.coverKey }).from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  if (p) await destroyImage(p.coverKey);
  await db.delete(blogPosts).where(eq(blogPosts.id, id));
  await audit("delete", "blog_posts", id);
  revalidatePublic(["blog"]);
  return { ok: true, message: "আর্টিকেল মুছে ফেলা হয়েছে" };
}

export async function saveBlogCategory(payload: { id?: number; name: { bn: string; en?: string }; slug?: string }): Promise<ActionResult> {
  await requireSession();
  if (!payload.name?.bn?.trim()) return { ok: false, message: "ক্যাটাগরির বাংলা নাম দিন" };
  const name = { bn: payload.name.bn.trim(), en: payload.name.en?.trim() || "" };
  const slug = payload.slug?.trim() ? slugify(payload.slug) : slugify(name.en || name.bn);
  if (payload.id) {
    await db.update(blogCategories).set({ name, slug }).where(eq(blogCategories.id, payload.id));
  } else {
    await db.insert(blogCategories).values({ name, slug }).onConflictDoNothing({ target: blogCategories.slug });
  }
  await audit("save", "blog_categories", payload.id, { name: name.bn });
  revalidatePublic(["blog"]);
  return { ok: true, message: "ক্যাটাগরি সংরক্ষণ হয়েছে" };
}

export async function deleteBlogCategory(id: number): Promise<ActionResult> {
  await requireSession();
  await db.delete(blogCategories).where(eq(blogCategories.id, id));
  revalidatePublic(["blog"]);
  return { ok: true, message: "ক্যাটাগরি মুছে ফেলা হয়েছে" };
}

export async function getPost(id: number): Promise<PostInitial | null> {
  const postId = Number(id);
  if (!Number.isFinite(postId)) return null;

  const { rows: postRows } = await db.execute<{
    id: number; slug: string; title: { bn?: string; en?: string } | null; excerpt: { bn?: string; en?: string } | null; content: { bn?: string; en?: string } | null;
    category_id: number | null; published: boolean; meta_title: { bn?: string; en?: string } | null;
    meta_description: { bn?: string; en?: string } | null; cover_url: string | null;
  }>(sql`SELECT * FROM blog_posts WHERE id=${postId}`);
  
  const post = postRows[0];
  if (!post) return null;

  return {
    id: post.id,
    slug: post.slug,
    title: toML(post.title),
    excerpt: toML(post.excerpt),
    content: toML(post.content),
    category_id: post.category_id,
    published: post.published,
    meta_title: toML(post.meta_title),
    meta_description: toML(post.meta_description),
    cover_url: post.cover_url,
  };
}

// ---------------- hero slides ----------------
const slideSchema = z.object({
  id: z.coerce.number().optional(),
  title: mlRequired("বাংলা শিরোনাম দিন"),
  text: mlSchema,
  icon: z.string().default("shield"),
  cta_label: mlSchema,
  cta_href: z.string().optional().default(""),
  sort: z.coerce.number().default(0),
  active: z.boolean().default(true),
  image_data: z.string().optional(),
  remove_image: z.boolean().default(false),
});

export async function saveSlide(payload: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = slideSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ" };
  const s = parsed.data;

  const existing = s.id
    ? (await db.select({ id: heroSlides.id, imageKey: heroSlides.imageKey }).from(heroSlides).where(eq(heroSlides.id, s.id)).limit(1))[0] ?? null
    : null;

  let image_key = existing?.imageKey ?? null;
  let image_url: string | null = null;
  let changed = false;
  if (s.remove_image && image_key) {
    await destroyImage(image_key);
    image_key = null;
    changed = true;
  } else if (s.image_data?.startsWith("data:image")) {
    const up = await uploadImage(s.image_data, "slides", image_key);
    image_key = up.key;
    image_url = up.url;
    changed = true;
  }

  if (existing) {
    const patch: Partial<typeof heroSlides.$inferInsert> = {
      title: s.title, text: s.text, icon: s.icon, ctaLabel: s.cta_label, ctaHref: s.cta_href || null,
      sort: s.sort, active: s.active,
    };
    if (changed) { patch.imageKey = image_key; patch.imageUrl = image_url; }
    await db.update(heroSlides).set(patch).where(eq(heroSlides.id, existing.id));
  } else {
    await db.insert(heroSlides).values({
      title: s.title, text: s.text, icon: s.icon, ctaLabel: s.cta_label, ctaHref: s.cta_href || null,
      sort: s.sort, active: s.active, imageKey: image_key, imageUrl: image_url,
    });
  }
  await audit("save", "hero_slides", s.id, { title: s.title.bn });
  revalidatePublic(["slides"]);
  return { ok: true, message: "স্লাইড সংরক্ষণ হয়েছে" };
}

export async function deleteSlide(id: number): Promise<ActionResult> {
  await requireSession();
  const [s] = await db.select({ imageKey: heroSlides.imageKey }).from(heroSlides).where(eq(heroSlides.id, id)).limit(1);
  if (s) await destroyImage(s.imageKey);
  await db.delete(heroSlides).where(eq(heroSlides.id, id));
  await audit("delete", "hero_slides", id);
  revalidatePublic(["slides"]);
  return { ok: true, message: "স্লাইড মুছে ফেলা হয়েছে" };
}

// ---------------- FAQs ----------------
const faqSchema = z.object({
  id: z.coerce.number().optional(),
  scope: z.enum(["home", "specialty", "area", "hospital", "doctor"]).default("home"),
  ref_id: z.coerce.number().nullable().optional(),
  question: mlRequired("বাংলা প্রশ্ন দিন"),
  answer: mlRequired("বাংলা উত্তর দিন"),
  sort: z.coerce.number().default(0),
  active: z.boolean().default(true),
});

export async function saveFaq(payload: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = faqSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ" };
  const f = parsed.data;
  const refId = f.scope === "home" ? null : f.ref_id || null;
  if (f.id) {
    await db
      .update(faqs)
      .set({ scope: f.scope, refId, question: f.question, answer: f.answer, sort: f.sort, active: f.active })
      .where(eq(faqs.id, f.id));
  } else {
    await db.insert(faqs).values({ scope: f.scope, refId, question: f.question, answer: f.answer, sort: f.sort, active: f.active });
  }
  await audit("save", "faqs", f.id);
  revalidatePublic(["faqs"]);
  return { ok: true, message: "FAQ সংরক্ষণ হয়েছে" };
}

export async function deleteFaq(id: number): Promise<ActionResult> {
  await requireSession();
  await db.delete(faqs).where(eq(faqs.id, id));
  await audit("delete", "faqs", id);
  revalidatePublic(["faqs"]);
  return { ok: true, message: "FAQ মুছে ফেলা হয়েছে" };
}

// ---------------- testimonials ----------------
const testimonialSchema = z.object({
  id: z.coerce.number().optional(),
  name: z.string().min(1, "নাম দিন"),
  area_text: mlSchema,
  quote: mlRequired("বাংলা মতামত দিন"),
  published: z.boolean().default(true),
  sort: z.coerce.number().default(0),
  photo_data: z.string().optional(),
  remove_photo: z.boolean().default(false),
});

export async function saveTestimonial(payload: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = testimonialSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ" };
  const tItem = parsed.data;

  const existing = tItem.id
    ? (await db.select({ id: testimonials.id, photoKey: testimonials.photoKey }).from(testimonials).where(eq(testimonials.id, tItem.id)).limit(1))[0] ?? null
    : null;
  let photo_key = existing?.photoKey ?? null;
  let photo_url: string | null = null;
  let changed = false;
  if (tItem.remove_photo && photo_key) {
    await destroyImage(photo_key);
    photo_key = null;
    changed = true;
  } else if (tItem.photo_data?.startsWith("data:image")) {
    const up = await uploadImage(tItem.photo_data, "testimonials", photo_key);
    photo_key = up.key;
    photo_url = up.url;
    changed = true;
  }

  if (existing) {
    const patch: Partial<typeof testimonials.$inferInsert> = {
      name: tItem.name, areaText: tItem.area_text, quote: tItem.quote,
      published: tItem.published, sort: tItem.sort,
    };
    if (changed) { patch.photoKey = photo_key; patch.photoUrl = photo_url; }
    await db.update(testimonials).set(patch).where(eq(testimonials.id, existing.id));
  } else {
    await db.insert(testimonials).values({
      name: tItem.name, areaText: tItem.area_text, quote: tItem.quote,
      published: tItem.published, sort: tItem.sort, photoKey: photo_key, photoUrl: photo_url,
    });
  }
  await audit("save", "testimonials", tItem.id, { name: tItem.name });
  revalidatePublic(["testimonials"]);
  return { ok: true, message: "মতামত সংরক্ষণ হয়েছে" };
}

export async function deleteTestimonial(id: number): Promise<ActionResult> {
  await requireSession();
  const [item] = await db.select({ photoKey: testimonials.photoKey }).from(testimonials).where(eq(testimonials.id, id)).limit(1);
  if (item) await destroyImage(item.photoKey);
  await db.delete(testimonials).where(eq(testimonials.id, id));
  await audit("delete", "testimonials", id);
  revalidatePublic(["testimonials"]);
  return { ok: true, message: "মতামত মুছে ফেলা হয়েছে" };
}

// ---------------- reviews moderation ----------------
export async function saveReview(payload: {
  id?: number; doctor_id: number; name: string; area_text?: string; body?: string; published: boolean;
}): Promise<ActionResult> {
  await requireSession();
  if (payload.id) {
    await db
      .update(reviews)
      .set({
        doctorId: payload.doctor_id, name: payload.name, areaText: payload.area_text || null,
        body: payload.body || null, published: payload.published,
      })
      .where(eq(reviews.id, payload.id));
  } else {
    await db.insert(reviews).values({
      doctorId: payload.doctor_id, name: payload.name, areaText: payload.area_text || null,
      body: payload.body || null, published: payload.published,
    });
  }
  await audit("save", "reviews", payload.id);
  revalidatePublic(["reviews", "doctors"]);
  return { ok: true, message: "রিভিউ সংরক্ষণ হয়েছে" };
}

export async function toggleReview(id: number, published: boolean): Promise<ActionResult> {
  await requireSession();
  await db.update(reviews).set({ published }).where(eq(reviews.id, id));
  await audit("update", "reviews", id, { published });
  revalidatePublic(["reviews", "doctors"]);
  return { ok: true, message: published ? "রিভিউ প্রকাশ হয়েছে" : "রিভিউ আনপাবলিশ হয়েছে" };
}

export async function deleteReview(id: number): Promise<ActionResult> {
  await requireSession();
  await db.delete(reviews).where(eq(reviews.id, id));
  await audit("delete", "reviews", id);
  revalidatePublic(["reviews", "doctors"]);
  return { ok: true, message: "রিভিউ মুছে ফেলা হয়েছে" };
}
