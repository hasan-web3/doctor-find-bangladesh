import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
import { getStaticPage } from "@/lib/static-pages";
import { StaticPageView } from "@/components/public/static-page-view";
import { isLocale, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const page = await getStaticPage("privacy", locale);
  if (!page) return {};
  return buildMetadata({
    locale,
    path: "/privacy",
    title: page.title,
    description: page.meta_description,
    ogTitle: page.title,
    ogSubtitle: locale === "bn" ? "গোপনীয়তা নীতি" : "Privacy Policy",
  });
}

export default async function PrivacyPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const page = await getStaticPage("privacy", locale);
  if (!page) notFound();
  return <StaticPageView page={page} locale={locale} maxWidthClass="max-w-site" />;
}
