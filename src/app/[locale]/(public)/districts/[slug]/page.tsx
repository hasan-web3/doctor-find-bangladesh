import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DoctorCard } from "@/components/public/doctor-card";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { Pagination } from "@/components/public/pagination";
import { ListingFilters, SortSelect, ListingSearch } from "@/components/public/listing-filters";
import { AnimatedGrid } from "@/components/animated-grid";
import {
  searchDoctors, getSpecialties, getAreas, searchHospitals,
  getDistrictsForSearch, getThanasForSearch,
  getDistrictBySlug,
  type DoctorSearchParams, type Area,
} from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { detectArea } from "@/lib/geo";
import { buildMetadata } from "@/lib/seo";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, num, type Locale } from "@/lib/i18n";
import { withPossessive as bnPossessive } from "@/lib/bn";

type SP = { [key: string]: string | string[] | undefined };
type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SP> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const district = await getDistrictBySlug(slug, locale);
  if (!district) return {};

  const title = locale === 'bn' ? `${district.name} জেলার ডাক্তারদের তালিকা` : `Doctors in ${district.name} District`;
  const description = locale === 'bn' 
    ? `${district.name} জেলার বিশেষজ্ঞ ডাক্তারদের সম্পূর্ণ তালিকা খুঁজুন। আপনার প্রয়োজন অনুযায়ী ফিল্টার করে সেরা ডাক্তার বেছে নিন।`
    : `Find a complete list of specialist doctors in ${district.name} District. Filter by your needs to choose the best doctor.`;

  return buildMetadata({
    locale,
    path: `/districts/${slug}`,
    title: district.meta_title || title,
    description: district.meta_description || description,
  });
}

export default async function DistrictDoctorsPage({ params, searchParams }: Props) {
  const { slug, locale } = await params;
  if (!isLocale(locale)) notFound();
  
  const sp = await searchParams;
  const d = getDict(locale);
  
  const perPageOptions = [12, 24, 48, 96];
  const perPage = sp.perPage ? Math.max(1, Number(sp.perPage)) : 12;
  const sanitizedPerPage = perPageOptions.includes(perPage) ? perPage : 12;

  const [settings, district, specialties, allThanas, hospitalData, geo, allDistricts, allSearchThanas] = await Promise.all([
    getSettings(),
    getDistrictBySlug(slug, locale),
    getSpecialties(locale),
    getAreas(locale) as Promise<Area[]>,
    searchHospitals({}, locale),
    detectArea(),
    getDistrictsForSearch(),
    getThanasForSearch(),
  ]);

  if (!district) notFound();

  const hospitals = hospitalData.rows;
  
  const query: DoctorSearchParams = {
    ...sp,
    district: [slug], // Always filter by the current district slug
    page: sp.page ? Math.max(1, Number(sp.page)) : 1,
    perPage: sanitizedPerPage,
    preferAreaId: !sp.area && !sp.sort ? geo.areaId : null,
    preferDistrictId: !sp.area && !sp.sort ? geo.districtId : null,
    preferLat: !sp.sort ? geo.lat : null,
    preferLng: !sp.sort ? geo.lng : null,
  };

  const { rows, total } = await searchDoctors(query, locale);
  const totalPages = Math.ceil(total / (query.perPage || 12));

  const pageTitle = locale === 'bn' ? `${district.name} জেলার ডাক্তারগণ` : `Doctors in ${district.name} District`;
  const pageSub = total > 0
    ? (locale === 'bn'
      ? `${num(total, locale)} জন যাচাইকৃত ডাক্তারের মধ্যে থেকে সেরা ডাক্তারদের বেছে নিন।`
      : `Choose from ${num(total, locale)} verified doctors.`)
    : d.listing_sub_empty;

  const breadcrumbs = [
    { name: d.breadcrumb_home, path: "/" },
    { name: d.nav_districts || "Districts", path: "/districts" },
    { name: district.name },
  ];

  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <Breadcrumbs locale={locale} items={breadcrumbs} />
      <h1 className="mb-1.5 font-heading text-[clamp(26px,4vw,34px)] font-bold text-ink">{pageTitle}</h1>
      <p className="mb-6 text-base text-ink-mute">{pageSub}</p>

      <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[260px_1fr]">
        <Suspense>
          <ListingFilters
            specialties={specialties.map((s) => ({ slug: s.slug, name: s.name }))}
            districts={allDistricts.map((x) => ({
              slug: x.slug,
              name: locale === "bn" ? x.name_bn : (x.name_en || x.name_bn),
              name_en: x.name_en,
            }))}
            thanas={allSearchThanas.map((t) => ({
              slug: t.slug,
              name: locale === "bn" ? t.name_bn : (t.name_en || t.name_bn),
              name_en: t.name_en,
              district_slug: t.district_slug,
            }))}
            hospitals={hospitals.map((h) => ({
              slug: h.slug,
              name: h.name,
              area_slug: h.area_slug ?? null,
              district_slug: h.district_slug ?? null,
            }))}
            locale={locale}
            d={d}
            districtSlug={slug}
          />
        </Suspense>

        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Suspense>
              <ListingSearch d={d} />
              <SortSelect d={d} />
            </Suspense>
          </div>
          {rows.length > 0 ? (
            <AnimatedGrid className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[1100px]:grid-cols-3 min-[1400px]:grid-cols-4">
              {rows.map((doc) => (
                <DoctorCard key={doc.id} doctor={doc} helpline={settings.helpline} locale={locale} d={d} />
              ))}
            </AnimatedGrid>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
              <div className="mb-2 font-heading text-lg font-bold text-ink">{d.no_doctors_found}</div>
              <p className="text-sm text-ink-faint">
                {d.no_doctors_found_sub} {locale === "bn" ? settings.helpline_bn : settings.helpline}
              </p>
            </div>
          )}

          <Pagination
            page={query.page || 1}
            totalPages={totalPages}
            locale={locale}
            perPage={sanitizedPerPage}
            showPerPageSelector
          />
        </div>
      </div>
    </div>
  );
}
