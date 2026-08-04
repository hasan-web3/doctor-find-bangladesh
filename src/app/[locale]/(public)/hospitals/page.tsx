import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { searchHospitals } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";
import { STATIC_GEO } from "@/lib/geo";
import { getDict } from "@/lib/dict";
import { isLocale, type Locale } from "@/lib/i18n";
import { HospitalListClient } from "@/components/public/hospital-list-client";

// ISR: hub; on-demand revalidated on mutation.
export const revalidate = 21600;

// See the note in ../areas/page.tsx: reading searchParams anywhere in a route
// forces `ƒ Dynamic`, so the server renders the canonical first page and
// <HospitalListClient> applies the query string after mount.
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const d = getDict(locale);
  const title = d.hospitals_title;
  const description = d.hospitals_sub;

  return buildMetadata({
    locale,
    path: "/hospitals",
    title,
    description,
  });
}

export default async function HospitalsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);

  const geo = STATIC_GEO;
  // Canonical first page — identical for every visitor, so it caches.
  const initialHospitalData = await searchHospitals({
    page: 1,
    perPage: 12,
  }, locale, geo);

  const pageTitle = d.hospitals_title;

  return <HospitalListClient 
    initialHospitals={initialHospitalData.rows}
    initialTotal={initialHospitalData.total}
    pageTitle={pageTitle} 
    locale={locale} 
    d={d} 
  />;
}

