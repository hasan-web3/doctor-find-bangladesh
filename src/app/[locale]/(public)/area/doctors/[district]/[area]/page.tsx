import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { LinkCloud } from "@/components/public/link-cloud";
import { getAreaBySlugs, getSpecialties, getFaqs, searchDoctors, countDoctorsFor, getAllAreaSlugPairs, getSpecialtiesInArea, getSiblingAreas } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { STATIC_GEO } from "@/lib/geo";
import { buildMetadata, findRedirect } from "@/lib/seo";
import { ldFaq } from "@/lib/seo-utils";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, type Locale } from "@/lib/i18n";
import { AreaDoctorListClient } from "@/components/public/area-doctor-list-client";

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
  const pairs = await getAllAreaSlugPairs();
  return pairs.map((p) => ({ district: p.district, area: p.area }));
}


// See the note in ../../../../areas/page.tsx: no searchParams server-side, or
// the route renders per request. <AreaDoctorListClient> applies them.
type Props = { params: Promise<{ locale: string; district: string, area: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, district, area: areaSlug } = await params;
  if (!isLocale(locale)) return {};
  const area = await getAreaBySlugs(district, areaSlug, locale);
  if (!area) return {};

  // A thana with no doctors renders an empty list — thin content. Keep it
  // reachable for visitors, but tell Google not to index it until it has
  // something to show. Lifts automatically when a doctor is assigned here.
  const doctorCount = await countDoctorsFor({ area: area.slug });

  const path = `/area/doctors/${district}/${areaSlug}`;
  return buildMetadata({
    locale,
    path,
    noindex: doctorCount === 0,
    title: area.meta_title || (locale === "bn" ? `${area.name} এর ডাক্তার তালিকা` : `Doctors in ${area.name}`),
    description:
      area.meta_description ||
      (locale === "bn"
        ? `${area.name}, ${area.district}-এর বিভিন্ন বিশেষজ্ঞ বিভাগের অভিজ্ঞ ডাক্তারদের তালিকা, চেম্বারের ঠিকানা ও সময়সূচি। সহজে অ্যাপয়েন্টমেন্ট নিন।`
        : `Experienced doctors across specialties in ${area.name}, ${area.district}, with chamber addresses and schedules. Book appointments easily.`),
    ogTitle: locale === "bn" ? `${area.name}-এর ডাক্তার ও চেম্বার` : `Doctors in ${area.name}`,
    noTemplate: Boolean(area.meta_title),
  });
}

export default async function AreaPage({ params }: Props) {
  const { locale: raw, district, area: areaSlug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const geo = STATIC_GEO;

  const area = await getAreaBySlugs(district, areaSlug, locale);
  if (!area) {
    const hit = await findRedirect(`/area/doctors/${district}/${areaSlug}`);
    if (hit) {
      const target = localeHref(locale, hit.to_path);
      if (hit.permanent) permanentRedirect(target);
      redirect(target);
    }
    notFound();
  }

  // Fetch initial data for the client component.
  // The client component will re-fetch if filters are applied.
  const [settings, allSpecialties, faqs, areaSpecialties, siblingAreas, initialDoctorData] = await Promise.all([
    getSettings(),
    getSpecialties(locale),
    getFaqs("area", area.id, locale),
    // The specialties that actually have doctors in THIS thana. Rendered below
    // as links to /specialties/<specialty>/<thana> — the combination pages.
    // Those pages are a whole section of the sitemap and, until this block
    // existed, had no inbound link anywhere on the site: the only way to reach
    // them was the client-side filter sidebar, which renders no anchors at all,
    // so Googlebot could never follow one. This is the page that should point
    // at them, because it is the closest topical parent they have.
    getSpecialtiesInArea(area.slug, locale),
    // Neighbouring thanas of the same district. This page IS a place, so there
    // is nothing to personalise: the sibling set is the same for every visitor
    // and stays in the cached HTML. It links thanas to each other instead of
    // making the district hub the only route between them.
    area.district_slug
      ? getSiblingAreas(area.district_slug, area.slug, locale)
      : Promise.resolve([]),
    searchDoctors({
      area: area.slug,
      page: 1,
      perPage: 12,
      preferAreaId: geo.areaId,
      preferDistrictId: geo.districtId,
      preferLat: geo.lat,
      preferLng: geo.lng,
      // A thana page belongs to one district, so that district's curated
      // order applies here regardless of where the visitor is.
      priorityDistrictId: area.district_id ?? null,
    }, locale),
  ]);

  const pageTitle = locale === "bn" ? `${area.name}-এর ডাক্তার ও চেম্বার` : `Doctors in ${area.name}`;
  
  return (
    <div>
      {faqs.length > 0 && <JsonLd data={ldFaq(faqs)} />}

      <div className="[background:linear-gradient(180deg,#FFF7ED,#F8FAFC)]">
        <div className="mx-auto max-w-site px-5 pb-10 pt-[26px]">
          {/* Both middle crumbs used to point at URLs that 308 away: `/area`
              redirects to `/areas` (next.config.ts) and `/area?district=x`
              redirects with it. A BreadcrumbList whose `item` URLs redirect is
              a wasted signal, and the district crumb now goes to the district's
              own listing, which is the page it actually names. */}
          <Breadcrumbs
            locale={locale}
            items={[
              { name: d.breadcrumb_home, path: "/" },
              { name: d.area_label, path: "/areas" },
              ...(area.district_slug
                ? [{ name: area.district, path: `/districts/${area.district_slug}/doctors` }]
                : []),
              { name: area.name }
            ]}
          />
          <h1 className="mb-3.5 font-heading text-[clamp(28px,4.5vw,40px)] font-bold text-ink">{pageTitle}</h1>
          {area.intro && <p className="m-0 max-w-[760px] text-base leading-[1.8] text-ink-mute">{area.intro}</p>}
        </div>
      </div>

      <div className="mx-auto max-w-site px-5 py-9">
        <AreaDoctorListClient
          allSpecialties={allSpecialties}
          locale={locale}
          settings={settings}
          initialDoctors={initialDoctorData.rows}
          initialTotal={initialDoctorData.total}
          districtSlug={area.district_slug ?? district}
          areaSlug={area.slug}
        />

        {/* Crawlable path down to the specialty × thana combination pages, and
            back up to the parent district listing. */}
        <LinkCloud
          title={d.hub_area_specialties_title_tpl.replace("{a}", area.name)}
          description={d.hub_area_specialties_desc}
          items={areaSpecialties}
          href={(s) => localeHref(locale, `/specialties/${s.slug}/${area.slug}`)}
          locale={locale}
          countSuffix={d.doctors_unit}
          limit={30}
        />

        <LinkCloud
          title={d.hub_nearby_areas_title_tpl.replace("{d}", area.district)}
          description={d.hub_nearby_areas_desc}
          items={siblingAreas}
          href={(a) => localeHref(locale, `/area/doctors/${a.district_slug}/${a.slug}`)}
          locale={locale}
          countSuffix={d.doctors_unit}
          limit={24}
          moreHref={area.district_slug ? localeHref(locale, `/districts/${area.district_slug}/doctors`) : undefined}
          moreLabel={d.hub_all_district_doctors_tpl.replace("{d}", area.district)}
        />

        {area.district_slug && (
          <LinkCloud
            title={d.hub_related_title}
            items={[
              {
                slug: area.district_slug,
                name: d.hub_all_district_doctors_tpl.replace("{d}", area.district),
                doctor_count: 0,
              },
            ]}
            href={(x) => localeHref(locale, `/districts/${x.slug}/doctors`)}
            locale={locale}
            countSuffix={d.doctors_unit}
            headingLevel="h3"
          />
        )}
      </div>

      {faqs.length > 0 && (
        <div className="mx-auto max-w-[820px] px-5 pb-[60px]">
          <h3 className="mb-[18px] mt-0 text-center font-heading text-[22px] font-bold text-ink">{d.faq_title}</h3>
          <div className="flex flex-col gap-3">
            {faqs.map((f) => (
              <div key={f.id} className="rounded-[14px] border border-line bg-white px-5 py-[18px]">
                <div className="mb-[7px] text-base font-semibold text-ink">{f.question}</div>
                <p className="m-0 text-[14.5px] leading-relaxed text-ink-mute">{f.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
