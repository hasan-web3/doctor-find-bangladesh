import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { ListingFilters, SortSelect, ListingSearch } from "@/components/public/listing-filters";
import { DoctorListClient } from "@/components/public/doctor-list-client";
import {
  searchDoctors, getSpecialties, getAreas, searchHospitals,
  getDistrictsForSearch, getThanasForSearch,
  getDistrictBySlug, countDoctorsFor,
  getAllDistrictSlugs,
  type DoctorSearchParams, type Area,
} from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { STATIC_GEO } from "@/lib/geo";
import { buildMetadata } from "@/lib/seo";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, num, type Locale } from "@/lib/i18n";
import { withPossessive as bnPossessive } from "@/lib/bn";

// ISR: hub; on-demand revalidated on mutation.
export const revalidate = 21600;

// Enumerated so these pages are PRERENDERED at build and then served from the
// ISR cache. An un-enumerated dynamic segment is re-rendered on every single
// request (verified against a production build: prebuilt params answer with
// `s-maxage`, un-enumerated ones with `private, no-store`).
//
// `dynamicParams` stays at its default (true), so a slug added after this
// deploy still resolves — it renders once, then caches like the rest.
export async function generateStaticParams() {
  const slugs = await getAllDistrictSlugs();
  return slugs.map((slug) => ({ slug }));
}


type SP = { [key: string]: string | string[] | undefined };
type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const district = await getDistrictBySlug(slug, locale);
  if (!district) return {};

  const title = locale === 'bn' ? `${district.name} জেলার ডাক্তারদের তালিকা` : `Doctors in ${district.name} District`;
  const description = locale === 'bn' 
    ? `${district.name} জেলার বিশেষজ্ঞ ডাক্তারদের সম্পূর্ণ তালিকা খুঁজুন। আপনার প্রয়োজন অনুযায়ী ফিল্টার করে সেরা ডাক্তার বেছে নিন।`
    : `Find a complete list of specialist doctors in ${district.name} District. Filter by your needs to choose the best doctor.`;

  // A district with no doctors in any of its thanas lists nothing — thin.
  const doctorCount = await countDoctorsFor({ district: slug });

  return buildMetadata({
    locale,
    path: `/districts/${slug}/doctors`,
    title: district.meta_title || title,
    description: district.meta_description || description,
    noindex: doctorCount === 0,
  });
}

export default async function DistrictDoctorsPage({ params }: Props) {
  const { slug, locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDict(locale);
  
  const sanitizedPerPage = 12;

  const [settings, district, specialties, allThanas, hospitalData, geo, allDistricts, allSearchThanas] = await Promise.all([
    getSettings(),
    getDistrictBySlug(slug, locale),
    getSpecialties(locale),
    getAreas(locale) as Promise<Area[]>,
    searchHospitals({}, locale),
    STATIC_GEO,
    getDistrictsForSearch(),
    getThanasForSearch(),
  ]);

  if (!district) notFound();

  const hospitals = hospitalData.rows;
  
  // Canonical, unfiltered first page. Filters/sort/pagination are applied
  // client-side against the API, so this render is the same for everyone.
  const query: DoctorSearchParams = {
    district: [slug], // Always filter by the current district slug
    page: 1,
    perPage: sanitizedPerPage,
    preferAreaId: geo.areaId,
    preferDistrictId: geo.districtId,
    preferLat: geo.lat,
    preferLng: geo.lng,
    // This page IS a district, so its own curated order wins over the
    // visitor's. Someone browsing /districts/khulna/doctors is asking about
    // Khulna, whatever their cookie says.
    priorityDistrictId: district.id,
  };

  const { rows, total } = await searchDoctors(query, locale);

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
          {/* The grid and its pagination used to be rendered here on the
              server, from a query that never read searchParams — so the
              filters, the sort control and the pager above all wrote to the
              URL and nothing responded. This route cannot read searchParams
              without losing ISR, so the client applies them instead, exactly
              as /doctors does. `rows` stays the canonical first page inside
              the cached HTML for crawlers and first paint. */}
          <DoctorListClient
            initialDoctors={rows}
            initialTotal={total}
            locale={locale}
            d={d}
            helpline={settings.helpline}
            helplineBn={settings.helpline_bn}
            defaultPerPage={sanitizedPerPage}
            lockedDistrictSlug={slug}
          />
        </div>
      </div>
    </div>
  );
}
