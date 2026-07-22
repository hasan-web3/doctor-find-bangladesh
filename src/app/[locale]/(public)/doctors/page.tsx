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
  type DoctorSearchParams, type Area,
} from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { detectArea } from "@/lib/geo";
import { buildMetadata } from "@/lib/seo";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, num, type Locale } from "@/lib/i18n";
import { withPossessive as bnPossessive } from "@/lib/bn";

type SP = { [key: string]: string | string[] | undefined };
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SP> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const sp = await searchParams;
  const pageNum = sp.page ? Math.max(1, Number(sp.page)) : 1;
  const hasThinFilter = Boolean(sp.q || sp.gender || sp.maxFee);

  const geo = await detectArea();
  const d = getDict(locale);
  const geoDistrictName = geo.districtName ? (locale === "bn" ? geo.districtName.bn : geo.districtName.en) : null;

  const title = geoDistrictName
    ? (locale === "bn" ? `${bnPossessive(geoDistrictName)} ডাক্তারদের তালিকা` : `Doctors in ${geoDistrictName}`)
    : (locale === "bn" ? "আপনার এলাকার ডাক্তারদের তালিকা" : "Doctors in Your Area");

  const description = geoDistrictName
    ? (locale === "bn"
      ? `${bnPossessive(geoDistrictName)} যাচাইকৃত বিশেষজ্ঞ ডাক্তারদের সম্পূর্ণ তালিকা। বিভাগ, এলাকা ও ফি অনুযায়ী ফিল্টার করে আপনার পছন্দের ডাক্তার বেছে নিন।`
      : `The complete list of verified specialist doctors in ${geoDistrictName}. Filter by specialty, area and fee to find your doctor.`)
    : d.listing_sub_empty;

  return buildMetadata({
    locale,
    path: "/doctors",
    title,
    description,
    ogTitle: title,
    canonicalQuery: pageNum > 1 ? `?page=${pageNum}` : undefined,
    noindex: hasThinFilter,
  });
}

export default async function DoctorsPage({ params, searchParams }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const sp = await searchParams;

  const perPageOptions = [12, 24, 48, 96];
  const perPage = sp.perPage ? Math.max(1, Number(sp.perPage)) : 12;
  const sanitizedPerPage = perPageOptions.includes(perPage) ? perPage : 12;

  const [settings, specialties, areas, hospitalData, geo, searchDistricts, searchThanas] = await Promise.all([
    getSettings(), getSpecialties(locale), getAreas(locale) as Promise<Area[]>, searchHospitals({}, locale), detectArea(),
    getDistrictsForSearch(), getThanasForSearch(),
  ]);

  const hospitals = hospitalData.rows;

  const geoDistrictName = geo.districtName ? (locale === "bn" ? geo.districtName.bn : geo.districtName.en) : null;
  const pageTitle = geoDistrictName
    ? (locale === "bn" ? `${bnPossessive(geoDistrictName)} ডাক্তারদের তালিকা` : `Doctors in ${geoDistrictName}`)
    : (locale === "bn" ? "আপনার এলাকার ডাক্তারদের তালিকা" : "Doctors in Your Area");


  const query: DoctorSearchParams = {
    q: typeof sp.q === "string" ? sp.q : undefined,
    specialty: sp.specialty,
    area: sp.area,
    district: sp.district,
    hospital: sp.hospital,
    gender: typeof sp.gender === "string" ? sp.gender : undefined,
    maxFee: sp.maxFee ? Number(sp.maxFee) : undefined,
    sort: (typeof sp.sort === "string" ? sp.sort : undefined) as DoctorSearchParams["sort"],
    page: sp.page ? Math.max(1, Number(sp.page)) : 1,
    perPage: sanitizedPerPage,
    preferAreaId: !sp.area && !sp.sort ? geo.areaId : null,
    preferLat: !sp.sort ? geo.lat : null,
    preferLng: !sp.sort ? geo.lng : null,
  };

  const { rows, total } = await searchDoctors(query, locale);
  const totalPages = Math.ceil(total / (query.perPage || 12));

  const pageSub = total > 0
  ? (geoDistrictName
    ? (locale === "bn"
      ? `${num(total, locale)} জন যাচাইকৃত ডাক্তারের মধ্যে থেকে ${bnPossessive(geoDistrictName)} সেরা ডাক্তারদের বেছে নিন।`
      : `Choose from ${num(total, locale)} verified doctors in ${geoDistrictName}.`)
    : `${num(total, locale)} ${d.listing_sub_prefix}`)
  : d.listing_sub_empty;


  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <Breadcrumbs locale={locale} items={[{ name: d.breadcrumb_home, path: "/" }, { name: d.breadcrumb_doctors }]} />
      <h1 className="mb-1.5 font-heading text-[clamp(26px,4vw,34px)] font-bold text-ink">{pageTitle}</h1>
      <p className="mb-6 text-base text-ink-mute">{pageSub}</p>

      <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[260px_1fr]">
        <Suspense>
          <ListingFilters
            specialties={specialties.map((s) => ({ slug: s.slug, name: s.name }))}
            districts={searchDistricts.map((x) => ({
              slug: x.slug,
              name: locale === "bn" ? x.name_bn : (x.name_en || x.name_bn),
              name_en: x.name_en,
            }))}
            thanas={searchThanas.map((t) => ({
              slug: t.slug,
              name: locale === "bn" ? t.name_bn : (t.name_en || t.name_bn),
              name_en: t.name_en,
              district_slug: t.district_slug,
            }))}
            hospitals={hospitals.map((h) => ({
              slug: h.slug,
              name: h.name,
              area_slug: h.area_slug ?? null,
            }))}
            locale={locale}
            d={d}
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
