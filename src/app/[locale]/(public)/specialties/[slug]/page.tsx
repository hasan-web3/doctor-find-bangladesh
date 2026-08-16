import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { SpecialtySlider } from "@/components/public/specialty-slider";
import { getSpecialtyBySlug, getSpecialties, getFaqsWithDefaults, searchDoctors, countDoctorsFor, resolveDisplayDistrict, geoSearchPrefs, getAllSpecialtySlugs, getAreasForSpecialty, getDistrictsForSpecialty } from "@/lib/data";
import { LinkCloud } from "@/components/public/link-cloud";
import { specialtyFaqSeeds } from "@/lib/faq-defaults";
import { GeoOrderedLinkCloud } from "@/components/public/geo-ordered-link-cloud";
import { FaqAccordion } from "@/components/public/faq-accordion";
import { getSettings } from "@/lib/settings";
import { STATIC_GEO } from "@/lib/geo";
import { buildMetadata, findRedirect } from "@/lib/seo";
import { ldFaq } from "@/lib/seo-utils";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, type Locale } from "@/lib/i18n";
import { withPossessive as bnPossessive, withSpecialistSuffix } from "@/lib/bn";
import { SpecialtyDoctorListClient } from "@/components/public/specialty-doctor-list-client";
import { ShownDistrictProvider } from "@/components/public/shown-district-context";
import { DistrictText } from "@/components/public/district-text";

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
  const slugs = await getAllSpecialtySlugs();
  return slugs.map((slug) => ({ slug }));
}


// See the note in ../../areas/page.tsx: no searchParams server-side, or the
// route renders per request. <SpecialtyDoctorListClient> applies them.
type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const [spec, geo] = await Promise.all([getSpecialtyBySlug(slug, locale), STATIC_GEO]);
  if (!spec) return {};

  // -------------------------------------------------------------------------
  // THIS IS THE NATIONAL PAGE FOR THE SPECIALTY. No district in the copy.
  //
  // It used to name whichever district the site resolved as canonical, which
  // was fine while exactly one district had doctors: /specialties/cardiology
  // WAS, in effect, the Khulna cardiology page. Now that
  // /districts/<district>/<specialty> covers that intent properly, leaving the
  // district here would give two URLs the same "খুলনার সেরা হৃদরোগ ডাক্তার"
  // heading, competing for one query. One URL can only answer one question.
  //
  //   /specialties/cardiology        -> the specialty itself, nationwide
  //   /districts/khulna/cardiology   -> "খুলনায় হৃদরোগ বিশেষজ্ঞ"
  //   /specialties/cardiology/boyra  -> the thana long tail
  //
  // An admin `meta_title` still wins, as everywhere else.
  // -------------------------------------------------------------------------
  // getSpecialties() already localizes these to plain strings (see the
  // projection in src/lib/data.ts). Passing one back through ml() localizes it
  // a SECOND time, and t() given a string instead of an MLText object returns
  // "" — which is why every specialty page fell back to the site default title.
  // Every other public page (area, blog, doctor, hospital, district) reads the
  // field directly; this one was the outlier.
  const title = spec.meta_title || (
    locale === "bn"
      ? `${withSpecialistSuffix(spec.name)} ডাক্তারদের তালিকা`
      : `${spec.name} Specialist Doctors`
  );

  const description = spec.meta_description || (
    locale === "bn"
      ? `বাংলাদেশের অভিজ্ঞ ও যাচাইকৃত ${withSpecialistSuffix(spec.name)} ডাক্তারদের তালিকা। জেলা অনুযায়ী বেছে নিয়ে চেম্বারের ঠিকানা, বসার সময় ও ভিজিট ফি দেখুন।`
      : `Experienced, verified ${spec.name} specialists across Bangladesh. Browse by district to see chamber addresses, sitting hours and visit fees.`
  );


  // Specialty hub with no doctors yet — thin. Matches the sitemap's rule.
  const doctorCount = await countDoctorsFor({ specialty: spec.slug });

  return buildMetadata({
    locale,
    path: `/specialties/${spec.slug}`,
    title,
    description,
    ogTitle: title,
    noTemplate: Boolean(spec.meta_title),
    noindex: doctorCount === 0,
  });
}


export default async function SpecialtyPage({ params }: Props) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);
  const [spec, geo] = await Promise.all([getSpecialtyBySlug(slug, locale), STATIC_GEO]);
  if (!spec) {
    const hit = await findRedirect(`/specialties/${slug}`);
    if (hit) {
      const target = L(hit.to_path);
      if (hit.permanent) permanentRedirect(target);
      redirect(target);
    }
    notFound();
  }

  // `display` joined this wave from further down the function. It resolves off
  // `geo`, which the wave above already produced, so awaiting it after the FAQs
  // bought nothing and cost the page a fourth round trip.
  const [settings, allSpecialties, specialtyAreas, specialtyDistricts, initialDoctorData, display] = await Promise.all([
    getSettings(),
    getSpecialties(locale),
    // The thanas where this specialty actually has doctors, linked as
    // /specialties/<this>/<thana>. Same destinations the thana pages link to,
    // approached from the other axis, so the combination pages sit in a two-way
    // link graph instead of hanging off a single thread.
    //
    // Capped at 80: a common specialty can span every district in the country,
    // and the block only ever renders 30 chips. Shipping the rest would be dead
    // payload on a page that already carries a doctor grid.
    getAreasForSpecialty(spec.slug, locale).then((rows) => rows.slice(0, 80)),
    // The districts where this specialty has doctors, linked as
    // /districts/<district>/<this>. The reverse of the specialty cloud on each
    // district page, so the two page types point at each other.
    getDistrictsForSpecialty(spec.slug, locale),
    // Canonical first page only. ?page= / ?perPage= / ?q= are applied by
    // <SpecialtyDoctorListClient> after mount — reading them here would force
    // this route to render per request and it would never be cached.
    searchDoctors({
      specialty: slug,
      page: 1,
      perPage: 12,
      ...(await geoSearchPrefs(geo, locale)),
    }, locale),
    resolveDisplayDistrict(geo, locale),
  ]);

  // Generated from this specialty's own coverage, then overlaid with any admin
  // edits. Empty when the specialty has no doctors, matching the noindex rule.
  const faqs = await getFaqsWithDefaults(
    "specialty",
    spec.id,
    specialtyFaqSeeds({
      name: spec.name,
      doctorCount: initialDoctorData.total,
      areas: specialtyAreas.map((a) => a.name),
    }),
    locale
  );

  const suggestedSpecialties = allSpecialties.filter((s) => s.id !== spec.id);

  const districtName = display?.name ?? null;

  // The <h1> is district-FREE, matching the title. See the long note in
  // generateMetadata: /districts/<district>/<specialty> is now the page that
  // answers "specialty in <district>", and if this heading also named a
  // district the two would fight over the same query.
  //
  // The <h2> over the list still follows the visitor, because the list itself
  // re-ranks after hydration and a heading that disagreed with the cards below
  // it would simply be wrong. That one is not a ranking target.
  const pageTitle = locale === "bn"
    ? `${withSpecialistSuffix(spec.name)} ডাক্তারদের তালিকা`
    : `${spec.name} Specialist Doctors`;

  const listTpl = locale === "bn"
    ? `{d} ${spec.name} ডাক্তারদের তালিকা`
    : `List of ${spec.name} Doctors in {d}`;
  const listFallback = locale === "bn"
    ? `আপনার এলাকার ${spec.name} ডাক্তারদের তালিকা`
    : `List of ${spec.name} Doctors Near You`;

  return (
    // Every district name on this page is read from here. The doctor list is
    // the only thing that queries doctors, so it publishes the district those
    // doctors are actually in and both headings follow it.
    <ShownDistrictProvider initialName={districtName} initialSlug={display?.slug ?? null}>
      {faqs.length > 0 && <JsonLd data={ldFaq(faqs)} />}

      <div className="[background:linear-gradient(180deg,#F0FDFA,#F8FAFC)]">
        <div className="mx-auto max-w-site px-5 pb-10 pt-[26px]">
          <Breadcrumbs
            locale={locale}
            items={[
              { name: d.breadcrumb_home, path: "/" },
              { name: d.nav_specialties, path: "/specialties" },
              { name: spec.name },
            ]}
          />
          <h1 className="mb-3.5 font-heading text-[clamp(28px,4.5vw,40px)] font-bold text-ink">
            {pageTitle}
          </h1>
          {spec.intro && (
            <p className="m-0 max-w-[760px] text-base leading-[1.8] text-ink-mute">{spec.intro}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-site px-5 pb-5 pt-9">
        <DistrictText
          as="h2"
          className="mb-5 mt-0 font-heading text-2xl font-bold text-ink"
          locale={locale}
          template={listTpl}
          fallback={listFallback}
        />
        <SpecialtyDoctorListClient
          locale={locale}
          settings={settings}
          initialDoctors={initialDoctorData.rows}
          initialTotal={initialDoctorData.total}
        />
      </div>

      {/* Down to the district version of this specialty. This is the link that
          makes the national page a hub rather than a competitor: it hands both
          readers and Googlebot the page that actually answers "<specialty> in
          <district>". Coverage-checked, so every chip has doctors behind it. */}
      <div className="mx-auto max-w-site px-5">
        <LinkCloud
          // The template carries no suffix of its own; withSpecialistSuffix
          // adds "বিশেষজ্ঞ" only to names that do not already contain it.
          title={d.hub_specialty_districts_title_tpl.replace(
            "{s}",
            locale === "bn" ? withSpecialistSuffix(spec.name) : spec.name
          )}
          description={d.hub_specialty_districts_desc}
          items={specialtyDistricts}
          href={(x) => L(`/districts/${x.slug}/${spec.slug}`)}
          locale={locale}
          countSuffix={d.doctors_unit}
          limit={64}
          moreHref={L("/districts")}
          moreLabel={d.view_all_districts}
        />
      </div>

      {/* The full candidate set already sits in the cached HTML (capped at 80
          rows below), so following the visitor's district here is a client-side
          sort with no request and no failure mode. Crawlers index the canonical
          order; a reader sees their own district's thanas lifted to the top. */}
      <div className="mx-auto max-w-site px-5">
        <GeoOrderedLinkCloud
          title={d.hub_specialty_areas_title_tpl.replace("{s}", spec.name)}
          description={d.hub_specialty_areas_desc}
          items={specialtyAreas}
          hrefTemplate={L(`/specialties/${spec.slug}/{slug}`)}
          locale={locale}
          countSuffix={d.doctors_unit}
          limit={30}
          moreHref={L("/areas")}
          moreLabel={d.view_all_areas}
        />
      </div>

      {suggestedSpecialties.length > 0 && (
        <div className="mx-auto max-w-site px-5 py-6">
          <h3 className="mb-3.5 mt-0 font-heading text-[19px] font-bold text-ink">
            {d.other_specialties}
          </h3>
          <SpecialtySlider slides={suggestedSpecialties} locale={locale} d={d} />
        </div>
      )}

      {faqs.length > 0 && (
        <div className="mx-auto max-w-[820px] px-5 pb-[60px] pt-[34px]">
          <h2 className="mb-[18px] mt-0 text-center font-heading text-[22px] font-bold text-ink">
            {spec.name} {d.spec_faq_suffix}
          </h2>
          <FaqAccordion faqs={faqs} />
        </div>
      )}
    </ShownDistrictProvider>
  );
}
