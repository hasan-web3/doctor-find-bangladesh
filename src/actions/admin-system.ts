"use server";

import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import {
  db,
  adminUsers,
  appointments,
  leads,
  promotions,
  redirects,
  seoOverrides,
  siteSettings,
  doctors,
} from "@/db";
import { requireSession, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { revalidatePublic } from "@/lib/revalidate";
import {
  saveIntegration, markIntegrationStatus, INTEGRATION_FIELDS,
  type IntegrationKey,
} from "@/lib/integrations";
import { testSmtp } from "@/lib/mailer";
import { sendNotification } from "@/lib/mailer";
import type { ActionResult } from "./admin-doctors";

// ---------------- appointments ----------------
export async function updateAppointmentStatus(
  id: number,
  status: "new" | "confirmed" | "completed" | "cancelled"
): Promise<ActionResult> {
  await requireSession();
  await db.update(appointments).set({ status, updatedAt: new Date() }).where(eq(appointments.id, id));
  await audit("update", "appointments", id, { status });
  return { ok: true, message: "স্ট্যাটাস আপডেট হয়েছে" };
}

// ---------------- promotions ----------------
const promotionSchema = z.object({
  id: z.coerce.number().optional(),
  doctor_id: z.coerce.number({ message: "ডাক্তার নির্বাচন করুন" }),
  plan: z.enum(["basic", "featured", "premium"]),
  amount: z.coerce.number().min(0),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "শুরুর তারিখ দিন"),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "শেষের তারিখ দিন"),
  status: z.enum(["active", "expired", "cancelled"]).default("active"),
  notes: z.string().optional().default(""),
});

async function syncDoctorFeatured(doctorId: number) {
  // featured/premium active promotion => featured flag on; none => off.
  await db
    .update(doctors)
    .set({
      featured: sql`EXISTS (
        SELECT 1 FROM promotions p WHERE p.doctor_id = ${doctors.id}
        AND p.status = 'active' AND p.plan IN ('featured','premium')
        AND p.ends_on >= CURRENT_DATE
      )`,
      updatedAt: new Date(),
    })
    .where(eq(doctors.id, doctorId));
}

export async function savePromotion(payload: unknown): Promise<ActionResult> {
  await requireSession();
  const parsed = promotionSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ" };
  const p = parsed.data;

  if (p.id) {
    await db
      .update(promotions)
      .set({
        doctorId: p.doctor_id, plan: p.plan, amount: p.amount,
        startsOn: p.starts_on, endsOn: p.ends_on, status: p.status,
        notes: p.notes || null, updatedAt: new Date(),
      })
      .where(eq(promotions.id, p.id));
  } else {
    await db.insert(promotions).values({
      doctorId: p.doctor_id, plan: p.plan, amount: p.amount,
      startsOn: p.starts_on, endsOn: p.ends_on, status: p.status, notes: p.notes || null,
    });
  }
  await syncDoctorFeatured(p.doctor_id);
  await audit("save", "promotions", p.id, { doctor_id: p.doctor_id, plan: p.plan, amount: p.amount });
  revalidatePublic(["doctors"]);
  return { ok: true, message: "পেমেন্ট রেকর্ড সংরক্ষণ হয়েছে" };
}

export async function deletePromotion(id: number): Promise<ActionResult> {
  await requireSession();
  const [row] = await db.select({ doctorId: promotions.doctorId }).from(promotions).where(eq(promotions.id, id)).limit(1);
  await db.delete(promotions).where(eq(promotions.id, id));
  if (row) await syncDoctorFeatured(row.doctorId);
  await audit("delete", "promotions", id);
  revalidatePublic(["doctors"]);
  return { ok: true, message: "পেমেন্ট রেকর্ড মুছে ফেলা হয়েছে" };
}

// ---------------- leads ----------------
export async function updateLeadStatus(
  id: number,
  status: "new" | "in_progress" | "resolved"
): Promise<ActionResult> {
  await requireSession();
  await db.update(leads).set({ status, updatedAt: new Date() }).where(eq(leads.id, id));
  await audit("update", "leads", id, { status });
  return { ok: true, message: "লিড আপডেট হয়েছে" };
}

// ---------------- SEO ----------------
export async function saveSeoOverride(payload: {
  id?: number;
  path: string;
  meta_title?: { bn: string; en: string };
  meta_description?: { bn: string; en: string };
  og_image_url?: string;
}): Promise<ActionResult> {
  await requireSession();
  const path = payload.path.trim();
  if (!path.startsWith("/")) return { ok: false, message: "পাথ অবশ্যই / দিয়ে শুরু হবে" };
  await db
    .insert(seoOverrides)
    .values({
      path,
      metaTitle: payload.meta_title || { bn: "", en: "" },
      metaDescription: payload.meta_description || { bn: "", en: "" },
      ogImageUrl: payload.og_image_url || null,
    })
    .onConflictDoUpdate({
      target: seoOverrides.path,
      set: {
        metaTitle: payload.meta_title || { bn: "", en: "" },
        metaDescription: payload.meta_description || { bn: "", en: "" },
        ogImageUrl: payload.og_image_url || null,
        updatedAt: new Date(),
      },
    });
  await audit("save", "seo_overrides", path);
  revalidatePublic(["seo"]);
  return { ok: true, message: "SEO ওভাররাইড সংরক্ষণ হয়েছে" };
}

export async function deleteSeoOverride(id: number): Promise<ActionResult> {
  await requireSession();
  await db.delete(seoOverrides).where(eq(seoOverrides.id, id));
  await audit("delete", "seo_overrides", id);
  revalidatePublic(["seo"]);
  return { ok: true, message: "ওভাররাইড মুছে ফেলা হয়েছে" };
}

export async function saveRedirect(payload: { from_path: string; to_path: string }): Promise<ActionResult> {
  await requireSession();
  const from = payload.from_path.trim();
  const to = payload.to_path.trim();
  if (!from.startsWith("/") || !to.startsWith("/")) return { ok: false, message: "পাথ অবশ্যই / দিয়ে শুরু হবে" };
  if (from === to) return { ok: false, message: "একই পাথে রিডাইরেক্ট করা যায় না" };
  await db
    .insert(redirects)
    .values({ fromPath: from, toPath: to })
    .onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: to } });
  await audit("save", "redirects", from, { to });
  revalidatePublic(["redirects"]);
  return { ok: true, message: "রিডাইরেক্ট সংরক্ষণ হয়েছে" };
}

export async function deleteRedirect(id: number): Promise<ActionResult> {
  await requireSession();
  await db.delete(redirects).where(eq(redirects.id, id));
  await audit("delete", "redirects", id);
  revalidatePublic(["redirects"]);
  return { ok: true, message: "রিডাইরেক্ট মুছে ফেলা হয়েছে" };
}

export async function regenerateSitemap(): Promise<ActionResult> {
  await requireSession();
  revalidatePublic(["sitemap"]);
  await audit("regenerate", "sitemap");
  return { ok: true, message: "সাইটম্যাপ রিফ্রেশ হয়েছে" };
}

// ---------------- site settings ----------------
export async function saveSettings(entries: Record<string, unknown>): Promise<ActionResult> {
  await requireSession();
  for (const [key, value] of Object.entries(entries)) {
    await db
      .insert(siteSettings)
      .values({ key, value: value as never })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: value as never, updatedAt: new Date() },
      });
  }
  await audit("update", "site_settings", null, { keys: Object.keys(entries) });
  revalidatePublic(["settings"]);
  return { ok: true, message: "সেটিংস সংরক্ষণ হয়েছে" };
}

// ---------------- integrations ----------------
async function resolveKeptSecrets(
  key: IntegrationKey,
  config: Record<string, string>
): Promise<Record<string, string>> {
  if (!Object.values(config).includes("__KEEP__")) return config;
  const { getIntegration } = await import("@/lib/integrations");
  const stored = (await getIntegration(key))?.config || {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = v === "__KEEP__" ? stored[k] || "" : v;
  }
  return out;
}

export async function saveIntegrationAction(
  key: IntegrationKey,
  enabled: boolean,
  config: Record<string, string>
): Promise<ActionResult> {
  await requireSession();
  if (!INTEGRATION_FIELDS[key]) return { ok: false, message: "অজানা ইন্টিগ্রেশন" };
  const resolved = await resolveKeptSecrets(key, config);
  await saveIntegration(key, enabled, resolved);
  await audit("update", "integrations", key, { enabled });
  revalidatePublic(["integrations"]);
  return { ok: true, message: "ইন্টিগ্রেশন সংরক্ষণ হয়েছে" };
}

export async function testIntegrationAction(
  key: IntegrationKey,
  rawConfig: Record<string, string>
): Promise<ActionResult> {
  await requireSession();
  const config = await resolveKeptSecrets(key, rawConfig);
  let result: { ok: boolean; message: string };

  try {
    switch (key) {
      case "smtp":
        result = await testSmtp(config);
        break;
      case "ip_geo": {
        if (config.provider === "ipinfo" && config.api_key) {
          const res = await fetch(`https://ipinfo.io/8.8.8.8?token=${config.api_key}`);
          result = res.ok
            ? { ok: true, message: "ipinfo সংযোগ সফল" }
            : { ok: false, message: `ipinfo ব্যর্থ (HTTP ${res.status})` };
        } else {
          const res = await fetch("http://ip-api.com/json/8.8.8.8?fields=status");
          const data = await res.json();
          result = data.status === "success"
            ? { ok: true, message: "ip-api সংযোগ সফল" }
            : { ok: false, message: "ip-api ব্যর্থ" };
        }
        break;
      }
      case "google_maps": {
        if (!config.api_key) { result = { ok: false, message: "API কী দিন" }; break; }
        // Geocoding API is the cheapest endpoint that also validates key + billing + referrer restrictions.
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=Khulna&key=${config.api_key}`
        );
        const data = await res.json();
        if (data.status === "OK" || data.status === "ZERO_RESULTS") {
          result = { ok: true, message: "Maps API কী সঠিক" };
        } else {
          // Google's error_message tells the real reason: API not enabled, billing off, referrer restriction, etc.
          const detail = data.error_message ? ` — ${data.error_message}` : "";
          result = { ok: false, message: `Maps ব্যর্থ (${data.status})${detail}` };
        }
        break;
      }
      case "recaptcha": {
        if (!config.secret_key) { result = { ok: false, message: "সিক্রেট কী দিন" }; break; }
        const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `secret=${encodeURIComponent(config.secret_key)}&response=test`,
        });
        const data = await res.json();
        result = data["error-codes"]?.includes("invalid-input-secret")
          ? { ok: false, message: "সিক্রেট কী সঠিক নয়" }
          : { ok: true, message: "reCAPTCHA কী সঠিক" };
        break;
      }
      case "sms": {
        if (!config.api_url) { result = { ok: false, message: "API URL দিন" }; break; }
        try {
          new URL(config.api_url);
          result = { ok: true, message: "কনফিগারেশন সংরক্ষিত (গেটওয়ে অনুযায়ী ফরম্যাট যাচাই করুন)" };
        } catch {
          result = { ok: false, message: "API URL সঠিক নয়" };
        }
        break;
      }
      case "analytics": {
        result = config.ga_id || config.gtm_id || config.fb_pixel_id
          ? { ok: true, message: "ট্র্যাকিং আইডি সংরক্ষিত" }
          : { ok: false, message: "অন্তত একটি আইডি দিন" };
        break;
      }
      default:
        result = { ok: false, message: "অজানা ইন্টিগ্রেশন" };
    }
  } catch (e) {
    result = { ok: false, message: `টেস্ট ব্যর্থ: ${e instanceof Error ? e.message : "unknown"}` };
  }

  await markIntegrationStatus(key, result.ok ? "ok" : "failed", result.message);
  await audit("test", "integrations", key, { ok: result.ok });
  revalidatePublic(["integrations"]);
  return result;
}

// ---------------- admin users ----------------
const userSchema = z.object({
  id: z.coerce.number().optional(),
  name: z.string().min(1, "নাম দিন"),
  email: z.string().email("সঠিক ইমেইল দিন"),
  password: z.string().optional(),
  role: z.enum(["super_admin", "admin", "editor"]).default("admin"),
  active: z.boolean().default(true),
});

export async function saveUser(payload: unknown): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "super_admin") return { ok: false, message: "শুধুমাত্র সুপার অ্যাডমিন ইউজার পরিচালনা করতে পারেন" };

  const parsed = userSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "তথ্য যাচাই ব্যর্থ" };
  const u = parsed.data;
  const email = u.email.trim().toLowerCase();

  if (u.id) {
    if (u.password && u.password.length > 0) {
      if (u.password.length < 8) return { ok: false, message: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে" };
      const hash = await hashPassword(u.password);
      await db
        .update(adminUsers)
        .set({ name: u.name, email, role: u.role, active: u.active, passwordHash: hash, updatedAt: new Date() })
        .where(eq(adminUsers.id, u.id));
    } else {
      await db
        .update(adminUsers)
        .set({ name: u.name, email, role: u.role, active: u.active, updatedAt: new Date() })
        .where(eq(adminUsers.id, u.id));
    }
  } else {
    if (!u.password || u.password.length < 8) return { ok: false, message: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে" };
    const [exists] = await db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
    if (exists) return { ok: false, message: "এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে" };
    const hash = await hashPassword(u.password);
    await db.insert(adminUsers).values({ name: u.name, email, passwordHash: hash, role: u.role, active: u.active });
  }
  await audit("save", "admin_users", u.id, { email });
  return { ok: true, message: "ইউজার সংরক্ষণ হয়েছে" };
}

export async function deleteUser(id: number): Promise<ActionResult> {
  const session = await requireSession();
  if (session.role !== "super_admin") return { ok: false, message: "শুধুমাত্র সুপার অ্যাডমিন ইউজার মুছতে পারেন" };
  if (session.id === id) return { ok: false, message: "নিজের অ্যাকাউন্ট মুছে ফেলা যায় না" };
  await db.delete(adminUsers).where(eq(adminUsers.id, id));
  await audit("delete", "admin_users", id);
  return { ok: true, message: "ইউজার মুছে ফেলা হয়েছে" };
}

// ---------------- misc ----------------
export async function sendTestEmail(): Promise<ActionResult> {
  await requireSession();
  const ok = await sendNotification("ডক্টরবন্ধু টেস্ট ইমেইল", "<p>SMTP ইন্টিগ্রেশন সঠিকভাবে কাজ করছে।</p>");
  return ok
    ? { ok: true, message: "টেস্ট ইমেইল পাঠানো হয়েছে" }
    : { ok: false, message: "ইমেইল পাঠানো যায়নি। SMTP কনফিগারেশন যাচাই করুন।" };
}

