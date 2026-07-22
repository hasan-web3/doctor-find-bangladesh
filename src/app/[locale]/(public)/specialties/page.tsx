import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { getSpecialties, type Specialty } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, num, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: "/specialties",
    title: locale === "bn" ? "বিশেষজ্ঞ বিভাগসমূহ" : "Medical Specialties",
    description:
      locale === "bn"
        ? "খুলনার সব বিশেষজ্ঞ বিভাগের তালিকা। রোগ অনুযায়ী সঠিক বিশেষজ্ঞ ডাক্তার বেছে নিন।"
        : "All medical specialties in Khulna. Choose the right specialist for your condition.",
  });
}

import { SpecialtyListClient } from "@/components/public/specialty-list-client";

export default async function SpecialtiesPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const specialties = await getSpecialties(locale, true) as Specialty[];

  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <Breadcrumbs locale={locale} items={[{ name: d.breadcrumb_home, path: "/" }, { name: d.nav_specialties }]} />
      <h1 className="mb-1.5 font-heading text-[clamp(26px,4vw,34px)] font-bold text-ink">{d.nav_specialties}</h1>
      <p className="mb-[26px] text-base text-ink-mute">{d.sec_specialties_title}</p>

      <SpecialtyListClient initialSpecialties={specialties} locale={locale} />
    </div>
  );
}
