"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, staticPages } from "@/db";
import { requireSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { revalidatePublic } from "@/lib/revalidate";
import { sanitizeHtml } from "@/lib/sanitize";
import { isStaticPageSlug } from "@/lib/static-pages";

export type ActionResult = { ok: boolean; message: string };

const ml = z.object({ bn: z.string().default(""), en: z.string().default("") });

const payloadSchema = z.object({
  slug: z.string().min(1),
  title: ml,
  meta_description: ml,
  content: ml,
});

// Admin-editable static pages (Privacy, Terms). Slug is fixed by seed; the
// action only updates existing rows so the admin cannot mint a new slug that
// the public router doesn't know about.
export async function saveStaticPage(payload: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ" };

  const { slug, title, meta_description, content } = parsed.data;
  if (!isStaticPageSlug(slug)) return { ok: false, message: "অজানা পেজ স্লাগ" };

  // Sanitize HTML from the rich-text editor before storing — same as blog/bio.
  const sanitized = { bn: sanitizeHtml(content.bn), en: sanitizeHtml(content.en) };

  const [existing] = await db
    .select({ slug: staticPages.slug })
    .from(staticPages)
    .where(eq(staticPages.slug, slug))
    .limit(1);
  if (!existing) return { ok: false, message: "পেজটি পাওয়া যায়নি" };

  await db
    .update(staticPages)
    .set({
      title,
      metaDescription: meta_description,
      content: sanitized,
      updatedAt: new Date(),
    })
    .where(eq(staticPages.slug, slug));

  await audit("update", "static_pages", 0, { slug });
  revalidatePublic(["static-pages"]);
  return { ok: true, message: "পেজ আপডেট হয়েছে" };
}
