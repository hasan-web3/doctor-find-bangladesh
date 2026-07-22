import "server-only";
import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { db, integrations } from "@/db";
import { decryptJson, encryptJson } from "./crypto";

export type IntegrationKey = "smtp" | "sms" | "google_maps" | "ip_geo" | "analytics" | "recaptcha";

export type IntegrationRow = {
  key: IntegrationKey;
  enabled: boolean;
  status: "never" | "ok" | "failed";
  status_message: string | null;
  last_tested_at: string | null;
  config: Record<string, string> | null;
};

// Field definitions drive both the admin UI form and validation.
export const INTEGRATION_FIELDS: Record<IntegrationKey, { label_bn: string; desc_bn: string; fields: { name: string; label_bn: string; secret?: boolean; placeholder?: string }[] }> = {
  smtp: {
    label_bn: "ইমেইল (SMTP)",
    desc_bn: "নতুন অ্যাপয়েন্টমেন্ট ও লিড এলে ইমেইল নোটিফিকেশন পাঠাতে ব্যবহৃত হয়।",
    fields: [
      { name: "host", label_bn: "SMTP হোস্ট", placeholder: "smtp.gmail.com" },
      { name: "port", label_bn: "পোর্ট", placeholder: "587" },
      { name: "user", label_bn: "ইউজারনেম" },
      { name: "pass", label_bn: "পাসওয়ার্ড", secret: true },
      { name: "from", label_bn: "প্রেরক ইমেইল", placeholder: "noreply@doctorbondhu.com" },
      { name: "to", label_bn: "নোটিফিকেশন প্রাপক", placeholder: "admin@doctorbondhu.com" },
    ],
  },
  sms: {
    label_bn: "এসএমএস গেটওয়ে",
    desc_bn: "অ্যাপয়েন্টমেন্ট কনফার্মেশনে রোগীকে এসএমএস পাঠাতে (ঐচ্ছিক)।",
    fields: [
      { name: "api_url", label_bn: "API URL", placeholder: "https://sms.example.com/send" },
      { name: "api_key", label_bn: "API কী", secret: true },
      { name: "sender_id", label_bn: "সেন্ডার আইডি" },
    ],
  },
  google_maps: {
    label_bn: "গুগল ম্যাপস",
    desc_bn: "হাসপাতাল ও চেম্বার পেজে ম্যাপ দেখাতে ব্যবহৃত হয়।",
    fields: [{ name: "api_key", label_bn: "Maps API কী", secret: true }],
  },
  ip_geo: {
    label_bn: "আইপি জিওলোকেশন",
    desc_bn: "ভিজিটরের এলাকা অনুযায়ী ডাক্তার আগে দেখাতে ব্যবহৃত হয়।",
    fields: [
      { name: "provider", label_bn: "প্রোভাইডার (ipapi / ipinfo)", placeholder: "ipapi" },
      { name: "api_key", label_bn: "API কী (ipapi হলে লাগবে না)", secret: true },
    ],
  },
  analytics: {
    label_bn: "অ্যানালিটিক্স ও পিক্সেল",
    desc_bn: "Google Analytics, GTM ও Facebook Pixel ট্র্যাকিং আইডি।",
    fields: [
      { name: "ga_id", label_bn: "Google Analytics ID", placeholder: "G-XXXXXXX" },
      { name: "gtm_id", label_bn: "GTM ID", placeholder: "GTM-XXXXXXX" },
      { name: "fb_pixel_id", label_bn: "Facebook Pixel ID" },
    ],
  },
  recaptcha: {
    label_bn: "reCAPTCHA",
    desc_bn: "ফর্ম স্প্যাম প্রতিরোধে Google reCAPTCHA v3।",
    fields: [
      { name: "site_key", label_bn: "সাইট কী" },
      { name: "secret_key", label_bn: "সিক্রেট কী", secret: true },
    ],
  },
};

const getAll = unstable_cache(
  async () => {
    return db
      .select({
        key: integrations.key,
        enabled: integrations.enabled,
        config_cipher: integrations.configCipher,
        status: integrations.status,
        status_message: integrations.statusMessage,
        last_tested_at: integrations.lastTestedAt,
      })
      .from(integrations);
  },
  ["integrations-all"],
  { tags: ["integrations"] }
);

export async function getIntegration(key: IntegrationKey): Promise<IntegrationRow | null> {
  const rows = await getAll();
  const row = rows.find((r) => r.key === key);
  if (!row) return null;
  return {
    key: row.key as IntegrationKey,
    enabled: row.enabled,
    status: row.status as IntegrationRow["status"],
    status_message: row.status_message,
    last_tested_at: row.last_tested_at
      ? (row.last_tested_at instanceof Date ? row.last_tested_at.toISOString() : String(row.last_tested_at))
      : null,
    config: decryptJson(row.config_cipher),
  };
}

// Returns config only when the integration is enabled and configured.
export async function getEnabledConfig(key: IntegrationKey): Promise<Record<string, string> | null> {
  const row = await getIntegration(key);
  if (!row || !row.enabled || !row.config) return null;
  return row.config;
}

export async function saveIntegration(
  key: IntegrationKey,
  enabled: boolean,
  config: Record<string, string>
) {
  await db
    .insert(integrations)
    .values({ key, enabled, configCipher: encryptJson(config) })
    .onConflictDoUpdate({
      target: integrations.key,
      set: { enabled, configCipher: encryptJson(config), updatedAt: new Date() },
    });
}

export async function markIntegrationStatus(
  key: IntegrationKey,
  status: "ok" | "failed",
  message: string
) {
  await db
    .update(integrations)
    .set({ status, statusMessage: message, lastTestedAt: new Date(), updatedAt: new Date() })
    .where(eq(integrations.key, key));
}

export async function getIntegrationRaw(key: IntegrationKey) {
  const [row] = await db
    .select({ key: integrations.key, enabled: integrations.enabled, config_cipher: integrations.configCipher })
    .from(integrations)
    .where(eq(integrations.key, key))
    .limit(1);
  return row ?? null;
}
