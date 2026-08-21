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
import { revalidatePublic, revalidateIntegrationStatus } from "@/lib/revalidate";
import {
  saveIntegration, markIntegrationStatus, INTEGRATION_FIELDS,
  type IntegrationKey,
} from "@/lib/integrations";
import { testSmtp, sendMail, emailLayout, activeProvider } from "@/lib/mailer";
import { testResend } from "@/lib/resend";
import { uploadImage, destroyImage, keyFromPublicUrl } from "@/lib/storage";
import { TOOLS } from "@/lib/tools/registry";
import type { ActionResult } from "./admin-doctors";

// Settings keys whose value is an image asset; if the incoming value is a
// data-URL we upload to R2, otherwise we pass through (raw URL or empty
// string). The sibling `<name>_key` field carries the R2 object key so the
// previous object can be destroyed on replace.
const IMAGE_KEYS = [
  { url: "logo_desktop_url", key: "logo_desktop_key", folder: "branding" },
  { url: "logo_mobile_url", key: "logo_mobile_key", folder: "branding" },
  { url: "logo_desktop_footer_url", key: "logo_desktop_footer_key", folder: "branding" },
  { url: "logo_mobile_footer_url", key: "logo_mobile_footer_key", folder: "branding" },
  { url: "favicon_url", key: "favicon_key", folder: "branding" },
  { url: "seo_default_og_image", key: "seo_default_og_image_key", folder: "seo" },
] as const;

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

  // OG card pipeline. This table stores only the URL, so the R2 key of the
  // image being replaced is recovered from the stored URL — an externally
  // pasted URL yields no key and is left alone.
  let ogImageUrl = payload.og_image_url?.trim() || null;
  const incoming = payload.og_image_url || "";
  if (incoming.startsWith("data:image") || !ogImageUrl) {
    const [existing] = await db
      .select({ ogImageUrl: seoOverrides.ogImageUrl })
      .from(seoOverrides)
      .where(eq(seoOverrides.path, path))
      .limit(1);
    const prevKey = keyFromPublicUrl(existing?.ogImageUrl);
    if (incoming.startsWith("data:image")) {
      const up = await uploadImage(incoming, "seo", prevKey);
      ogImageUrl = up.url;
    } else if (prevKey) {
      // Cleared: drop the object rather than orphan it in the bucket.
      await destroyImage(prevKey);
    }
  }

  await db
    .insert(seoOverrides)
    .values({
      path,
      metaTitle: payload.meta_title || { bn: "", en: "" },
      metaDescription: payload.meta_description || { bn: "", en: "" },
      ogImageUrl,
    })
    .onConflictDoUpdate({
      target: seoOverrides.path,
      set: {
        metaTitle: payload.meta_title || { bn: "", en: "" },
        metaDescription: payload.meta_description || { bn: "", en: "" },
        ogImageUrl,
        updatedAt: new Date(),
      },
    });
  await audit("save", "seo_overrides", path);
  revalidatePublic(["seo"]);
  return { ok: true, message: "SEO ওভাররাইড সংরক্ষণ হয়েছে" };
}

export async function deleteSeoOverride(id: number): Promise<ActionResult> {
  await requireSession();
  const [existing] = await db
    .select({ ogImageUrl: seoOverrides.ogImageUrl })
    .from(seoOverrides)
    .where(eq(seoOverrides.id, id))
    .limit(1);
  await destroyImage(keyFromPublicUrl(existing?.ogImageUrl));
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

  // Image pipeline: intercept the logo / favicon / OG-card URL fields. If the
  // incoming value is a data:image URL, upload it to R2 (destroying the
  // previous object first) and replace the entry with the public URL. Non-data
  // values (existing URLs, empty string clears) fall through untouched.
  // The R2 object key is stashed under `<name>_key` so the next replace
  // can destroy the old object without leaking storage.
  const patched: Record<string, unknown> = { ...entries };
  for (const { url, key, folder } of IMAGE_KEYS) {
    const incoming = patched[url];
    if (typeof incoming !== "string" || !incoming.startsWith("data:image")) continue;
    const [existing] = await db
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, key))
      .limit(1);
    const prevKey = typeof existing?.value === "string" ? existing.value : null;
    const up = await uploadImage(incoming, folder, prevKey);
    patched[url] = up.url;
    patched[key] = up.key;
  }
  // Explicit empty-string clear: also drop the sibling R2 object.
  for (const { url, key } of IMAGE_KEYS) {
    if (patched[url] === "" && !(key in patched)) {
      const [existing] = await db
        .select({ value: siteSettings.value })
        .from(siteSettings)
        .where(eq(siteSettings.key, key))
        .limit(1);
      const prevKey = typeof existing?.value === "string" ? existing.value : null;
      if (prevKey) await destroyImage(prevKey);
      patched[key] = "";
    }
  }

  for (const [key, value] of Object.entries(patched)) {
    await db
      .insert(siteSettings)
      .values({ key, value: value as never })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: value as never, updatedAt: new Date() },
      });
  }
  await audit("update", "site_settings", null, { keys: Object.keys(patched) });
  revalidatePublic(["settings"]);
  return { ok: true, message: "সেটিংস সংরক্ষণ হয়েছে" };
}

// ---------------- health tools ----------------

/**
 * Turn the /tools calculators on and off.
 *
 * A separate action rather than a `tools_enabled` key passed through
 * saveSettings(), for one reason that matters: this is the only settings change
 * that adds or removes public URLs, so it is the only one that has to rebuild
 * the sitemap. saveSettings() deliberately does not — `settings` is not in
 * SITEMAP_TAGS (see lib/revalidate.ts), because rebuilding every shard for a
 * changed helpline number would be the most expensive purge in the app for no
 * benefit. Here it is required, so it is requested explicitly.
 *
 * Unknown keys are dropped rather than stored. The map is keyed by the registry
 * `key`, so accepting arbitrary keys would let a removed or renamed tool leave
 * a permanent orphan row in site_settings that nothing ever reads again.
 */
export async function saveToolToggles(toggles: Record<string, boolean>): Promise<ActionResult> {
  await requireSession();

  const clean: Record<string, boolean> = {};
  for (const tool of TOOLS) {
    const v = toggles[tool.key];
    if (typeof v === "boolean") clean[tool.key] = v;
  }

  await db
    .insert(siteSettings)
    .values({ key: "tools_enabled", value: clean as never })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: clean as never, updatedAt: new Date() },
    });

  await audit("update", "site_settings", null, { keys: ["tools_enabled"] });
  // `settings` is layout-wide, which is correct here: the navbar and the mobile
  // tab bar both change, and those render into every cached page.
  revalidatePublic(["settings"], { sitemap: true });
  return { ok: true, message: "\u099f\u09c1\u09b2 \u09b8\u09c7\u099f\u09bf\u0982\u09b8 \u09b8\u0982\u09b0\u0995\u09cd\u09b7\u09a3 \u09b9\u09df\u09c7\u099b\u09c7" };
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
      case "resend":
        // Validates the key and the sender domain without sending an email.
        // Use the "টেস্ট ইমেইল পাঠান" button for an actual delivery check.
        result = await testResend(config);
        break;
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
  // Status-only write — deliberately does NOT purge public ISR. See revalidate.ts.
  revalidateIntegrationStatus();
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
// Real delivery check. Goes to the logged-in admin's own address, so no
// recipient needs configuring anywhere.
export async function sendTestEmail(to?: string): Promise<ActionResult> {
  const session = await requireSession();

  const provider = await activeProvider();
  if (!provider) {
    return { ok: false, message: "কোনো ইমেইল প্রোভাইডার চালু নেই। ইন্টিগ্রেশন পেজ থেকে Resend চালু করুন।" };
  }

  const recipient = to?.trim() || session.email;
  const sentAt = new Date().toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" });
  const res = await sendMail({
    to: recipient,
    subject: "ডক্টরস ফাইন্ড বাংলাদেশ টেস্ট ইমেইল",
    html: emailLayout(
      "ইমেইল সেটআপ ঠিক আছে",
      `<p style="margin:0 0 10px;">এই ইমেইলটি পেয়েছেন মানে ইমেইল পাঠানোর সংযোগ ঠিকভাবে কাজ করছে।</p>
       <p style="margin:0;color:#8593A0;font-size:13px;">পাঠানোর সময়: ${sentAt}</p>`,
      "এটি একটি স্বয়ংক্রিয় টেস্ট ইমেইল।"
    ),
    tags: [{ name: "type", value: "test" }],
  });

  await audit("test", "integrations", provider, { ok: res.ok, kind: "email" });

  return res.ok
    ? { ok: true, message: `টেস্ট ইমেইল ${recipient} ঠিকানায় পাঠানো হয়েছে` }
    : { ok: false, message: res.message };
}

