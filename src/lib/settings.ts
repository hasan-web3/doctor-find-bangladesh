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
  // The site's NAME as an entity — what Google prints above the blue link in
  // search results, and what goes into og:site_name / WebSite / Organization
  // JSON-LD. Deliberately separate from `brand_name`, which admins also use for
  // on-page header/footer copy and had been set to a tagline ("Find The Right
  // Care Near You Always"); Google can't match a tagline to the domain, so it
  // fell back to printing "doctorsfindbd.com". Keep this short, stable, and
  // recognisably related to the domain.
  site_name: MLText;
  helpline: string;
  helpline_bn: string;
  whatsapp: string;
  email: string;
  // Contact-form confirmation routing. `contact_email_from` is the SENDER the
  // visitor sees (its domain must be verified in Resend); `contact_email_bcc`
  // is a comma-separated list of team addresses that get a silent copy, kept
  // out of To: so the visitor never sees internal addresses.
  contact_email_from: string;
  contact_email_bcc: string;
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
  logo_desktop_footer_url: string;
  logo_mobile_footer_url: string;
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
  site_name: { bn: "ডক্টরস ফাইন্ড বাংলাদেশ", en: "Doctors Find Bangladesh" },
  helpline: "01774739914",
  helpline_bn: "০১৭৭৪৭৩৯৯১৪",
  whatsapp: "8801774739914",
  email: "",
  contact_email_from: "contact@doctorsfindbd.com",
  contact_email_bcc: "",
  address: { bn: "খুলনা, বাংলাদেশ", en: "Khulna, Bangladesh" },
  facebook: "",
  youtube: "",
  instagram: "",
  logo_url: "",
  logo_desktop_url: "",
  logo_mobile_url: "",
  logo_desktop_footer_url: "",
  logo_mobile_footer_url: "",
  favicon_url: "",
  show_plans: true,
  // Bilingual keyword embedding: the Bangla defaults carry English brand +
  // location terms ("Doctors in Khulna", "Khulna Doctors Directory") so the
  // Bangla page ranks natively for English queries from Bangladeshi users
  // ("doctors in khulna", "khulna doctor list") without any hreflang tricks.
  // This is Google-recommended — bilingual pages legitimately match both
  // language queries when the tokens actually appear in the page's meta.
  seo_title_template: { bn: "%s | ডক্টরস ফাইন্ড বাংলাদেশ - Doctors Find Bangladesh", en: "%s | Doctors Find Bangladesh" },
  seo_default_title: {
    bn: "খুলনার সেরা ডাক্তার খুঁজুন - Best Doctors in Khulna | ডক্টরস ফাইন্ড বাংলাদেশ",
    en: "Find the Best Doctors in Khulna | Doctors Find Bangladesh",
  },
  seo_default_description: {
    bn: "খুলনার যাচাইকৃত বিশেষজ্ঞ ডাক্তার এলাকা ও বিভাগ অনুযায়ী খুঁজুন এবং সহজে অ্যাপয়েন্টমেন্ট নিন। Find verified specialist doctors in Khulna by area and specialty — book appointments online with Bangladesh's trusted doctor directory.",
    en: "Find verified specialist doctors in Khulna by area and specialty, and book appointments easily.",
  },
  seo_default_og_image: "",
  plans: [],
  stats: [],
};

// Only the raw DB rows are cached — the DEFAULTS merge happens on every read,
// below. Caching the *merged* object meant a newly added setting (e.g.
// `site_name`) stayed `undefined` for as long as the cached entry lived, since
// the stored blob had been built before the key existed and Vercel's data cache
// survives deploys. Merging after the read makes new keys work immediately.
const getSettingRows = unstable_cache(
  async () => {
    try {
      return await db.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
    } catch {
      // DB unreachable (e.g. build without .env): fall back so metadata never crashes.
      return [] as { key: string; value: unknown }[];
    }
  },
  // Cache key deliberately differs from the old "site-settings" entry: that one
  // holds the merged object, which has an incompatible shape.
  ["site-settings-rows"],
  { tags: ["settings"] }
);

export async function getSettings(): Promise<SiteSettings> {
  const rows = await getSettingRows();
  const merged: Record<string, unknown> = { ...DEFAULTS };
  for (const row of rows) merged[row.key] = row.value;
  return merged as SiteSettings;
}
