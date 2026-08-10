import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { ListingFilters, SortSelect, ListingSearch } from "@/components/public/listing-filters";
import { DoctorListClient } from "@/components/public/doctor-list-client";
import { LinkCloud } from "@/components/public/link-cloud";
import { FaqBlock } from "@/components/public/faq-block";
import { JsonLd } from "@/components/json-ld";
import { ldFaq, ldItemList } from "@/lib/seo-utils";
import {
  searchDoctors, getSpecialties, getHospitalOptions,
  getDistrictsForSearch, getThanasForSearch,
  getDistrictBySlug, countDoctorsFor,
  getAllDistrictSlugs, getDistrictHubLinks, getFaqsWithDefaults,
  type DoctorSearchParams,
} from "@/lib/data";
import { districtFaqSeeds } from "@/lib/faq-defaults";
import { getSettings } from "@/lib/settings";
import { STATIC_GEO } from "@/lib/geo";
import { buildMetadata } from "@/lib/seo";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, num, type Locale } from "@/lib/i18n";
import { withPossessive as bnPossessive } from "@/lib/bn";

// ISR: hub; on-demand revalidated on mutation. 24h is the no-change ceiling.
export const revalidate = 86400;

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


type Props = { params: Promise<{ locale: string; slug: string }> };

// ---------------------------------------------------------------------------
// SEARCH INTENT.
//
// This page targets the highest-volume query pattern on the site: "<district>
// doctor" / "doctor in <district>". It used to be titled "Doctors in Khulna
// District" / "খুলনা জেলার ডাক্তারদের তালিকা" — the word "District" narrows the
// phrase away from what people actually type, and neither variant carried the
// "best / সেরা" qualifier that the specialty pages have always used. The two
// hubs now word themselves the same way.
//
// An admin `meta_title` on the district row still wins over all of this.
// ---------------------------------------------------------------------------
function districtTitle(name: string, locale: Locale): string {
  return locale === "bn"
    ? `${bnPossessive(name)} সেরা ডাক্তারদের তালিকা`
    : `Best Doctors in ${name}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const district = await getDistrictBySlug(slug, locale);
  if (!district) return {};

  const title = districtTitle(district.name, locale);
  const description = locale === 'bn'
    ? `${bnPossessive(district.name)} যাচাইকৃত বিশেষজ্ঞ ডাক্তারদের সম্পূর্ণ তালিকা। বিভাগ, এলাকা ও হাসপাতাল অনুযায়ী ফিল্টার করে চেম্বারের ঠিকানা, বসার সময় ও ভিজিট ফি দেখে অ্যাপয়েন্টমেন্ট নিন।`
    : `The complete list of verified specialist doctors in ${district.name}. Filter by specialty, area and hospital, then check chamber address, sitting hours and visit fee before you book.`;

  // A district with no doctors in any of its thanas lists nothing — thin.
  const doctorCount = await countDoctorsFor({ district: slug });

  return buildMetadata({
    locale,
    path: `/districts/${slug}/doctors`,
    title: district.meta_title || title,
    description: district.meta_description || description,
    noTemplate: Boolean(district.meta_title),
    noindex: doctorCount === 0,
  });
}

export default async function DistrictDoctorsPage({ params }: Props) {
  const { slug, locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);

  const sanitizedPerPage = 12;

  // No `getAreas` here: the thana filter is fed by getThanasForSearch() below.
  // This page used to also fetch the full 619-row area list and never read it.
  const [settings, district, specialties, hospitals, geo, allDistricts, allSearchThanas] = await Promise.all([
    getSettings(),
    getDistrictBySlug(slug, locale),
    getSpecialties(locale),
    getHospitalOptions(locale),
    STATIC_GEO,
    getDistrictsForSearch(),
    getThanasForSearch(),
  ]);

  if (!district) notFound();

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

  // The doctor list, the FAQ block and the internal-link hub are all
  // district-scoped and independent, so they are fetched together. None of them
  // reads searchParams, cookies or headers, so the page stays fully static/ISR.
  const [{ rows, total }, hub] = await Promise.all([
    searchDoctors(query, locale),
    getDistrictHubLinks(slug, locale),
  ]);

  // FAQs are GENERATED from this district's own data and then have the admin's
  // edits applied on top. Nothing has to be written by hand for a district to
  // get its block: the seeds name the real thanas, specialties and hospitals
  // below, and return an empty list when the district has no doctors, which is
  // the same condition that keeps it out of the sitemap.
  const faqs = await getFaqsWithDefaults(
    "district",
    district.id,
    districtFaqSeeds({
      name: district.name,
      doctorCount: total,
      thanas: hub.thanas.map((x) => x.name),
      specialties: hub.specialties.map((x) => x.name),
      hospitals: hub.hospitals.map((x) => x.name),
    }),
    locale
  );

  const pageTitle = districtTitle(district.name, locale);
  const pageSub = total > 0
    ? (locale === 'bn'
      ? `${num(total, locale)} জন যাচাইকৃত ডাক্তারের মধ্যে থেকে সেরা ডাক্তারদের বেছে নিন।`
      : `Choose from ${num(total, locale)} verified doctors.`)
    : d.listing_sub_empty;

  // Body copy. The admin-written `districts.intro` has always existed in the
  // database and was already being read here — it was simply never rendered, so
  // this page shipped with a heading, a one-line subtitle and nothing else. The
  // generic fallback keeps a district that has no intro yet from being empty.
  const placeName = locale === "bn" ? bnPossessive(district.name) : district.name;
  const intro = district.intro?.trim()
    || d.district_intro_fallback_tpl.replace("{d}", placeName);

  const breadcrumbs = [
    { name: d.breadcrumb_home, path: "/" },
    { name: d.nav_districts || "Districts", path: "/districts" },
    { name: district.name },
  ];

  const fill = (tpl: string) => tpl.replace("{d}", district.name);

  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      {/* ItemList describes the doctors actually rendered below; FAQPage only
          ships when the district has FAQs, so an empty district emits neither. */}
      <JsonLd
        data={[
          ...(rows.length > 0 ? [ldItemList(pageTitle, rows, locale)] : []),
          ...(faqs.length > 0 ? [ldFaq(faqs)] : []),
        ]}
      />

      <Breadcrumbs locale={locale} items={breadcrumbs} />
      <h1 className="mb-1.5 font-heading text-[clamp(26px,4vw,34px)] font-bold text-ink">{pageTitle}</h1>
      <p className="mb-4 text-base text-ink-mute">{pageSub}</p>
      <p className="mb-7 max-w-[820px] text-[15px] leading-[1.9] text-ink-mute">{intro}</p>

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

      {/* ------------------------------------------------------------------
          CRAWLABLE INTERNAL LINKS.

          The filter sidebar above is client-side state and renders no anchors,
          so before these blocks existed this page linked nowhere except the 12
          doctor cards. These three clouds hand Googlebot (and a reader who
          wants to narrow down by hand) a real path into the thana pages, the
          specialty hubs and the hospital pages of this district — and the thana
          pages in turn link on to the specialty × thana combination pages.

          Every link is coverage-checked in the query, so none of them can point
          at a page that renders an empty list.
          ------------------------------------------------------------------ */}
      <LinkCloud
        title={fill(d.hub_areas_title_tpl)}
        description={d.hub_areas_desc}
        items={hub.thanas}
        href={(a) => L(`/area/doctors/${a.district_slug}/${a.slug}`)}
        locale={locale}
        countSuffix={d.doctors_unit}
        limit={30}
        moreHref={L("/areas")}
        moreLabel={d.view_all_areas}
      />

      <LinkCloud
        title={fill(d.hub_specialties_title_tpl)}
        description={d.hub_specialties_desc}
        items={hub.specialties}
        href={(s) => L(`/specialties/${s.slug}`)}
        locale={locale}
        countSuffix={d.doctors_unit}
        limit={30}
        moreHref={L("/specialties")}
        moreLabel={d.view_all_specialties}
      />

      <LinkCloud
        title={fill(d.hub_hospitals_title_tpl)}
        description={d.hub_hospitals_desc}
        items={hub.hospitals}
        href={(h) => L(`/hospitals/${h.slug}`)}
        locale={locale}
        countSuffix={d.doctors_unit}
        limit={20}
        moreHref={L("/hospitals")}
        moreLabel={d.view_all_hospitals}
      />

      <FaqBlock title={d.district_faq_title} faqs={faqs} />
    </div>
  );
}
