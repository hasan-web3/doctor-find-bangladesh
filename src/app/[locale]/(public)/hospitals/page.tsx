import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { searchHospitals } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";
import { detectArea } from "@/lib/geo";
import { getDict } from "@/lib/dict";
import { isLocale, type Locale } from "@/lib/i18n";
import { HospitalListClient } from "@/components/public/hospital-list-client";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string, perPage?: string }> };

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

export default async function HospitalsPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const sp = await searchParams;

  const geo = await detectArea();
  const initialHospitalData = await searchHospitals({ 
    page: Number(sp.page || '1'),
    perPage: Number(sp.perPage || '12'),
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

