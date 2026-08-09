import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { SpecialtySlider } from "@/components/public/specialty-slider";
import { getSpecialtyBySlug, getSpecialties, getFaqs, searchDoctors, countDoctorsFor, resolveDisplayDistrict, geoSearchPrefs, getAllSpecialtySlugs, getAreasForSpecialty } from "@/lib/data";
import { LinkCloud } from "@/components/public/link-cloud";
import { getSettings } from "@/lib/settings";
import { STATIC_GEO } from "@/lib/geo";
import { buildMetadata, findRedirect } from "@/lib/seo";
import { ldFaq } from "@/lib/seo-utils";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, type Locale } from "@/lib/i18n";
import { withPossessive as bnPossessive } from "@/lib/bn";
import { SpecialtyDoctorListClient } from "@/components/public/specialty-doctor-list-client";
import { ShownDistrictProvider } from "@/components/public/shown-district-context";
import { DistrictText } from "@/components/public/district-text";

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

  const districtName = (await resolveDisplayDistrict(geo, locale))?.name || (locale === "bn" ? "খুলনা" : "Khulna");
  const isIpDetected = geo.source === "ip-name" || geo.source === "ip-nearest";
  // getSpecialties() already localizes these to plain strings (see the
  // projection in src/lib/data.ts). Passing one back through ml() localizes it
  // a SECOND time, and t() given a string instead of an MLText object returns
  // "" — which is why every specialty page fell back to the site default title.
  // Every other public page (area, blog, doctor, hospital, district) reads the
  // field directly; this one was the outlier.
  // Parenthesised: `a || b ? x : y` binds as `(a || b) ? x : y`, which would
  // hand every specialty the "near you" wording as soon as an override existed.
  const title = spec.meta_title || (
    isIpDetected
      ? (locale === "bn" ? `আপনার সবচেয়ে কাছের সেরা ${spec.name} ডাক্তার` : `Best ${spec.name} Doctors Near You`)
      : (locale === "bn" ? `${bnPossessive(districtName)} সেরা ${spec.name} ডাক্তার` : `Best ${spec.name} Doctors in ${districtName}`)
  );
  
  const description = spec.meta_description || (
    isIpDetected
      ? (locale === "bn" ? `আপনার সবচেয়ে কাছের অভিজ্ঞ ও যাচাইকৃত ${spec.name} বিশেষজ্ঞ ডাক্তারদের তালিকা, চেম্বারের ঠিকানা, সময়সূচি ও ভিজিট ফি।` : `Experienced, verified ${spec.name} specialists near you with chamber addresses, schedules and visit fees.`)
      : (locale === "bn" ? `${bnPossessive(districtName)} অভিজ্ঞ ও যাচাইকৃত ${spec.name} বিশেষজ্ঞ ডাক্তারদের তালিকা, চেম্বারের ঠিকানা, সময়সূচি ও ভিজিট ফি।` : `Experienced, verified ${spec.name} specialists in ${districtName} with chamber addresses, schedules and visit fees.`)
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

  const [settings, allSpecialties, faqs, specialtyAreas, initialDoctorData] = await Promise.all([
    getSettings(),
    getSpecialties(locale),
    getFaqs("specialty", spec.id, locale),
    // The thanas where this specialty actually has doctors, linked as
    // /specialties/<this>/<thana>. Same destinations the thana pages link to,
    // approached from the other axis, so the combination pages sit in a two-way
    // link graph instead of hanging off a single thread.
    getAreasForSpecialty(spec.slug, locale),
    // Canonical first page only. ?page= / ?perPage= / ?q= are applied by
    // <SpecialtyDoctorListClient> after mount — reading them here would force
    // this route to render per request and it would never be cached.
    searchDoctors({
      specialty: slug,
      page: 1,
      perPage: 12,
      ...(await geoSearchPrefs(geo, locale)),
    }, locale),
  ]);

  const suggestedSpecialties = allSpecialties.filter((s) => s.id !== spec.id);

  const display = await resolveDisplayDistrict(geo, locale);
  const districtName = display?.name ?? null;

  // Both headings name a district and the list under them re-ranks for the
  // visitor after hydration, so the copy has to move with it — otherwise a
  // Dhaka visitor reads a Khulna heading over a grid of Dhaka doctors. The
  // server still renders the canonical name into the tags, so the <h1> in the
  // cached HTML is complete for crawlers and for first paint.
  const titleTpl = locale === "bn"
    ? `{d} সেরা ${spec.name} ডাক্তার`
    : `Best ${spec.name} Doctors in {d}`;
  const titleFallback = locale === "bn"
    ? `আপনার সবচেয়ে কাছের সেরা ${spec.name} ডাক্তার`
    : `Best ${spec.name} Doctors Near You`;

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
          <DistrictText
            as="h1"
            className="mb-3.5 font-heading text-[clamp(28px,4.5vw,40px)] font-bold text-ink"
            locale={locale}
            template={titleTpl}
            fallback={titleFallback}
          />
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

      <div className="mx-auto max-w-site px-5">
        <LinkCloud
          title={d.hub_specialty_areas_title_tpl.replace("{s}", spec.name)}
          description={d.hub_specialty_areas_desc}
          items={specialtyAreas}
          href={(a) => L(`/specialties/${spec.slug}/${a.slug}`)}
          locale={locale}
          countSuffix={d.doctors_unit}
          limit={36}
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
          <h3 className="mb-[18px] mt-0 text-center font-heading text-[22px] font-bold text-ink">
            {locale === "bn" ? `${spec.name} ${d.spec_faq_suffix}` : `${spec.name} ${d.spec_faq_suffix}`}
          </h3>
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
    </ShownDistrictProvider>
  );
}
