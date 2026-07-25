import "server-only";
import { unstable_cache } from "next/cache";
import { db, siteSettings } from "@/db";
import type { MLText } from "./i18n";

export type Plan = {
  key: string;
  name: MLText;
  price: number;
  period: MLText;
  popular: boolean;
  feats: MLText[];
};

export type StatItem = { value: number; suffix: string; label: MLText };

export type SiteSettings = {
  brand_name: MLText;
  helpline: string;
  helpline_bn: string;
  whatsapp: string;
  email: string;
  address: MLText;
  facebook: string;
  youtube: string;
  instagram: string;
  // Legacy single-logo field — kept for backwards compatibility with any code
  // that reads it directly; new code should prefer logo_desktop_url.
  logo_url: string;
  // Brand-logo pipeline. Desktop shows in the top navbar and footer at ~48px
  // height; mobile is a squarer / simpler mark used on narrow viewports;
  // favicon feeds <link rel="icon">. When ANY of these is empty, the UI
  // falls back to rendering the localised `brand_name` as text.
  logo_desktop_url: string;
  logo_mobile_url: string;
  favicon_url: string;
  show_plans: boolean;
  seo_title_template: MLText;
  seo_default_title: MLText;
  seo_default_description: MLText;
  seo_default_og_image: string;
  plans: Plan[];
  stats: StatItem[];
};

const DEFAULTS: SiteSettings = {
  brand_name: { bn: "ডক্টরস ফাইন্ড বাংলাদেশ", en: "Doctors Find Bangladesh" },
  helpline: "01774739914",
  helpline_bn: "০১৭৭৪৭৩৯৯১৪",
  whatsapp: "8801774739914",
  email: "",
  address: { bn: "খুলনা, বাংলাদেশ", en: "Khulna, Bangladesh" },
  facebook: "",
  youtube: "",
  instagram: "",
  logo_url: "",
  logo_desktop_url: "",
  logo_mobile_url: "",
  favicon_url: "",
  show_plans: true,
  seo_title_template: { bn: "%s | ডক্টরস ফাইন্ড বাংলাদেশ", en: "%s | Doctors Find Bangladesh" },
  seo_default_title: {
    bn: "খুলনার সেরা ডাক্তার খুঁজুন | ডক্টরস ফাইন্ড বাংলাদেশ",
    en: "Find the Best Doctors in Khulna | Doctors Find Bangladesh",
  },
  seo_default_description: {
    bn: "খুলনার যাচাইকৃত বিশেষজ্ঞ ডাক্তার এলাকা ও বিভাগ অনুযায়ী খুঁজুন এবং সহজে অ্যাপয়েন্টমেন্ট নিন।",
    en: "Find verified specialist doctors in Khulna by area and specialty, and book appointments easily.",
  },
  seo_default_og_image: "",
  plans: [],
  stats: [],
};

export const getSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    try {
      const rows = await db.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
      const merged: Record<string, unknown> = { ...DEFAULTS };
      for (const row of rows) merged[row.key] = row.value;
      return merged as SiteSettings;
    } catch {
      // DB unreachable (e.g. build without .env): fall back so metadata never crashes.
      return DEFAULTS;
    }
  },
  ["site-settings"],
  { tags: ["settings"] }
);
