import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getAreaBySlug } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";
import { isLocale, localeHref, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string; slug: string }> };

// Keep metadata for old links shared on social media
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const area = await getAreaBySlug(slug, locale);
  if (!area) return {};
  return buildMetadata({
    locale,
    path: `/areas/${area.slug}`,
    title: area.meta_title || (locale === "bn" ? `${area.name} এর ডাক্তার তালিকা` : `Doctors in ${area.name}`),
    description:
      area.meta_description ||
      (locale === "bn"
        ? `${area.name} এলাকার অভিজ্ঞ ডাক্তারদের তালিকা ও চেম্বারের ঠিকানা।`
        : `List of experienced doctors and chamber addresses in ${area.name} area.`),
  });
}

export default async function OldAreaRedirectPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const area = await getAreaBySlug(slug, locale as Locale);

  if (area?.district_slug) {
    const newPath = localeHref(locale, `/area/doctors/${area.district_slug}/${area.slug}`);
    permanentRedirect(newPath);
  } else {
    // If the area doesn't exist or doesn't have a district slug for some reason,
    // redirect to the main areas page as a fallback.
    permanentRedirect(localeHref(locale, "/areas"));
  }

  // This part should not be reached due to the redirects, but return null to be safe.
  return null;
}

