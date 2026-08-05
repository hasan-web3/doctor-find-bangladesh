import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { ListingFilters, SortSelect, ListingSearch } from "@/components/public/listing-filters";
import { DoctorListClient } from "@/components/public/doctor-list-client";
import { DoctorsPageHeading } from "@/components/public/doctors-page-heading";
import { ShownDistrictProvider } from "@/components/public/shown-district-context";
import {
  searchDoctors, getSpecialties, getAreas, searchHospitals,
  getDistrictsForSearch, getThanasForSearch, resolveDisplayDistrict, geoSearchPrefs,
  type DoctorSearchParams, type Area,
} from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { STATIC_GEO } from "@/lib/geo";
import { buildMetadata } from "@/lib/seo";
import { getDict } from "@/lib/dict";
import { isLocale, type Locale } from "@/lib/i18n";
import { withPossessive as bnPossessive } from "@/lib/bn";

// ISR: highest-traffic listing.
export const revalidate = 900;

// See the note in ../areas/page.tsx. This page carries the heaviest filter set
// on the site (specialty, area, district, hospital, gender, fee, sort, page),
// and all of it now runs through <DoctorListClient> against /api/doctors. The
// server renders only the canonical unfiltered first page, so one cached
// document serves every visitor and every crawler.
//
// Canonical consequence, stated explicitly: /doctors?page=2 no longer emits a
// self-referential canonical — it consolidates to /doctors. That is a
// deliberate, standard pagination-consolidation choice, not an oversight.
// The old `noindex` on thin filter combinations is likewise gone; those URLs
// now canonicalise to /doctors, which achieves the same end.
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const geo = STATIC_GEO;
  const d = getDict(locale);
  const geoDistrictName = (await resolveDisplayDistrict(geo, locale))?.name ?? null;

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
  });
}

export default async function DoctorsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);

  const sanitizedPerPage = 12;

  const [settings, specialties, areas, hospitalData, geo, searchDistricts, searchThanas] = await Promise.all([
    getSettings(), getSpecialties(locale), getAreas(locale) as Promise<Area[]>, searchHospitals({}, locale), STATIC_GEO,
    getDistrictsForSearch(), getThanasForSearch(),
  ]);

  const hospitals = hospitalData.rows;

  const geoDistrictName = (await resolveDisplayDistrict(geo, locale))?.name ?? null;

  const geoPrefs = await geoSearchPrefs(geo, locale);

  // The canonical, unfiltered first page. Filters, sort and pagination are
  // applied by <DoctorListClient> against /api/doctors.
  const query: DoctorSearchParams = {
    page: 1,
    perPage: sanitizedPerPage,
    preferAreaId: geoPrefs.preferAreaId,
    preferDistrictId: geoPrefs.preferDistrictId,
    preferLat: geoPrefs.preferLat,
    preferLng: geoPrefs.preferLng,
    // Unconditional: an explicit filter or sort narrows *which* doctors are
    // listed, it does not mean the admin's curated order stops applying.
    priorityDistrictId: geoPrefs.priorityDistrictId,
  };

  const { rows, total } = await searchDoctors(query, locale);

  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <Breadcrumbs locale={locale} items={[{ name: d.breadcrumb_home, path: "/" }, { name: d.breadcrumb_doctors }]} />
      {/* The heading names the district of the cards actually on screen. It sits
          above the filter grid while the cards sit inside it, so the value
          travels between them through this provider. */}
      <ShownDistrictProvider initialName={geoDistrictName}>
      <DoctorsPageHeading
        canonicalDistrictName={geoDistrictName}
        total={total}
        locale={locale}
        d={d}
      />

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
              district_slug: h.district_slug ?? null,
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
          <DoctorListClient
            initialDoctors={rows}
            initialTotal={total}
            locale={locale}
            d={d}
            helpline={settings.helpline}
            helplineBn={settings.helpline_bn}
            defaultPerPage={sanitizedPerPage}
          />
        </div>
      </div>
      </ShownDistrictProvider>
    </div>
  );
}
