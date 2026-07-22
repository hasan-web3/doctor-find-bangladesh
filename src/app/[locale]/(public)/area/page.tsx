import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { searchAreas } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";
import { getDict } from "@/lib/dict";
import { isLocale, type Locale } from "@/lib/i18n";
import { AreaListClient } from "@/components/public/area-list-client";
import { detectArea } from "@/lib/geo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; page?: string; perPage?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: "/area",
    title: locale === "bn" ? "এলাকা অনুযায়ী ডাক্তার" : "Doctors by Area",
    description:
      locale === "bn"
        ? "খুলনার প্রতিটি এলাকার যাচাইকৃত ডাক্তার ও চেম্বারের তালিকা। আপনার কাছের এলাকা বেছে নিন।"
        : "Verified doctors and chambers for every area of Khulna. Pick the area nearest to you.",
  });
}

export default async function AreasPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const sp = await searchParams;

  const geo = await detectArea();
  const initialAreasData = await searchAreas({
    q: sp.q,
    page: Number(sp.page || '1'),
    perPage: Number(sp.perPage || '24'),
    preferLat: geo.lat,
    preferLng: geo.lng
  }, locale);

  const geoDistrictName = geo.districtName
    ? (locale === "bn" ? geo.districtName.bn : geo.districtName.en) || null
    : null;
  
  const areaSub = geoDistrictName
    ? (locale === "bn"
        ? `${geoDistrictName}র প্রতিটি এলাকার যাচাইকৃত ডাক্তার ও চেম্বারের তালিকা। আপনার কাছাকাছি বিশেষজ্ঞ খুঁজুন।`
        : `List of verified doctors and chambers in each area of ${geoDistrictName}. Find specialists near you.`)
    : d.sec_area_sub;

  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <Breadcrumbs locale={locale} items={[{ name: d.breadcrumb_home, path: "/" }, { name: d.nav_areas }]} />
      <h1 className="mb-1.5 font-heading text-[clamp(26px,4vw,34px)] font-bold text-ink">{d.sec_area_title}</h1>
      <p className="mb-8 text-base text-ink-mute">{areaSub}</p>

      <AreaListClient 
        userLat={geo.lat}
        userLng={geo.lng}
        locale={locale}
        initialAreas={initialAreasData.rows}
        initialTotal={initialAreasData.total}
      />
    </div>
  );
}
