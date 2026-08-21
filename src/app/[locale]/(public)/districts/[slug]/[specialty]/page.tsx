import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { DoctorCard } from "@/components/public/doctor-card";
import { LinkCloud } from "@/components/public/link-cloud";
import { FaqAccordion } from "@/components/public/faq-accordion";
import { JsonLd } from "@/components/json-ld";
import { ldFaq, ldItemList } from "@/lib/seo-utils";
import {
  getDistrictBySlug, getSpecialtyBySlug, searchDoctors, countDoctorsFor,
  getDistrictHubLinks, getDistrictSpecialtyPairs, getSpecialtiesInArea,
} from "@/lib/data";
import { districtSpecialtyFaqSeeds } from "@/lib/faq-defaults";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, num, type Locale } from "@/lib/i18n";
import { withPossessive as bnPossessive, withSpecialistSuffix } from "@/lib/bn";

// ISR: hub; on-demand revalidated on mutation. 24h is the no-change ceiling.
// Deliberately still 24h. Listing pages are NOT purged when a doctor changes
// (see the KNOWN GAP note in src/lib/revalidate.ts) so this timer is the only
// thing that surfaces a new doctor here. Do not raise it until that is fixed.
export const revalidate = 86400;

// ---------------------------------------------------------------------------
// THE HIGHEST-INTENT PAGE ON THE SITE: /districts/khulna/cardiology
//
// "খুলনায় হৃদরোগ বিশেষজ্ঞ" is how people actually search. Until this route
// existed the site had the thana version (/specialties/<spec>/<thana>) but not
// the district one, so the high-volume half of that pattern had no page of its
// own and fell back to /specialties/<spec> — a single URL that can only ever
// name one district in its heading.
//
// Why the URL is /districts/<district>/<specialty> and not
// /specialties/<specialty>/<district>: the second segment of the specialty
// route is already a THANA slug, and district and thana slugs share a
// namespace. Hanging this off the district hub keeps the two unambiguous.
// ---------------------------------------------------------------------------

// Enumerated so every pairing that has doctors is prerendered and then served
// from the ISR cache. `dynamicParams` stays true, so a pairing created after
// this deploy still resolves and starts being cached on first request.
export async function generateStaticParams() {
  const pairs = await getDistrictSpecialtyPairs();
  return pairs.map((p) => ({ slug: p.district_slug, specialty: p.specialty_slug }));
}

type Props = { params: Promise<{ locale: string; slug: string; specialty: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug, specialty } = await params;
  if (!isLocale(locale)) return {};
  const [district, spec] = await Promise.all([
    getDistrictBySlug(slug, locale),
    getSpecialtyBySlug(specialty, locale),
  ]);
  if (!district || !spec) return {};

  // Same rule as every other landing page: a pairing with no doctors is an
  // empty list, so it stays out of the index until it has something to show.
  const doctorCount = await countDoctorsFor({ district: slug, specialty: spec.slug });
  const short = spec.name.split(" (")[0];

  return buildMetadata({
    locale,
    path: `/districts/${slug}/${spec.slug}`,
    noindex: doctorCount === 0,
    title: locale === "bn"
      ? `${bnPossessive(district.name)} সেরা ${withSpecialistSuffix(short)} ডাক্তার`
      : `Best ${short} Doctors in ${district.name}`,
    description: locale === "bn"
      ? `${bnPossessive(district.name)} অভিজ্ঞ ও যাচাইকৃত ${withSpecialistSuffix(spec.name)} ডাক্তারদের তালিকা। চেম্বারের ঠিকানা, বসার সময় ও ভিজিট ফি দেখে সরাসরি অ্যাপয়েন্টমেন্ট নিন।`
      : `Experienced, verified ${spec.name} specialists in ${district.name}. Check chamber address, sitting hours and visit fee, then book directly.`,
    ogTitle: locale === "bn"
      ? `${bnPossessive(district.name)} ${short} ডাক্তার`
      : `${short} Doctors in ${district.name}`,
  });
}

export default async function DistrictSpecialtyPage({ params }: Props) {
  const { locale: raw, slug, specialty } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);

  const [district, spec] = await Promise.all([
    getDistrictBySlug(slug, locale),
    getSpecialtyBySlug(specialty, locale),
  ]);
  if (!district || !spec) notFound();

  const [settings, { rows, total }, hub] = await Promise.all([
    getSettings(),
    // Both filters at once. No searchParams are read, so the page stays static
    // and one cached document serves every visitor and every crawler.
    searchDoctors(
      { district: [slug], specialty: spec.slug, page: 1, perPage: 24, priorityDistrictId: district.id },
      locale
    ),
    getDistrictHubLinks(slug, locale),
  ]);

  const short = spec.name.split(" (")[0];
  const placeName = locale === "bn" ? bnPossessive(district.name) : district.name;
  const pageTitle = locale === "bn"
    ? `${placeName} সেরা ${withSpecialistSuffix(short)} ডাক্তার`
    : `Best ${short} Doctors in ${district.name}`;

  const intro = locale === "bn"
    ? `${placeName} অভিজ্ঞ ${withSpecialistSuffix(spec.name)} ডাক্তারদের তালিকা এক জায়গায়। প্রতিটি প্রোফাইলে ডিগ্রি, অভিজ্ঞতা, চেম্বারের ঠিকানা, বসার সময় ও ভিজিট ফি দেওয়া আছে, তাই বাসা থেকে বের হওয়ার আগেই আপনি জানতে পারবেন কোথায় কখন যেতে হবে।`
    : `A complete list of experienced ${spec.name} specialists in ${district.name}. Every profile carries degrees, experience, chamber address, sitting hours and visit fee, so you know where to go and when before you leave home.`;

  // Thanas of this district that have a doctor in THIS specialty, so the links
  // below drop straight onto pages that are not empty.
  const areasWithSpec = (
    await Promise.all(
      hub.thanas.slice(0, 12).map(async (t) => {
        const specs = await getSpecialtiesInArea(t.slug, locale);
        return specs.some((s) => s.slug === spec.slug) ? t : null;
      })
    )
  ).filter(Boolean) as typeof hub.thanas;

  const faqs = districtSpecialtyFaqSeeds({
    specialty: short,
    district: district.name,
    doctorCount: total,
    areas: areasWithSpec.map((a) => a.name),
    hospitals: hub.hospitals.map((h) => h.name),
  }).map((seed, i) => ({
    id: -(i + 1),
    question: seed.question[locale] || seed.question.bn,
    answer: seed.answer[locale] || seed.answer.bn,
  }));

  return (
    <div>
      <JsonLd
        data={[
          ...(rows.length > 0 ? [ldItemList(pageTitle, rows, locale)] : []),
          ...(faqs.length > 0 ? [ldFaq(faqs)] : []),
        ]}
      />

      <div className="[background:linear-gradient(180deg,#F0FDFA,#F8FAFC)]">
        <div className="mx-auto max-w-site px-5 pb-10 pt-[26px]">
          <Breadcrumbs
            locale={locale}
            items={[
              { name: d.breadcrumb_home, path: "/" },
              { name: district.name, path: `/districts/${slug}/doctors` },
              { name: spec.name },
            ]}
          />
          <h1 className="mb-3.5 font-heading text-[clamp(28px,4.5vw,40px)] font-bold text-ink">{pageTitle}</h1>
          <p className="m-0 max-w-[820px] text-base leading-[1.9] text-ink-mute">{intro}</p>
        </div>
      </div>

      <div className="mx-auto max-w-site px-5 py-9">
        {rows.length > 0 ? (
          <>
            <p className="mb-5 mt-0 text-base text-ink-mute">
              {locale === "bn"
                ? `${num(total, locale)} জন যাচাইকৃত ${withSpecialistSuffix(short)}ের মধ্যে থেকে বেছে নিন।`
                : `Choose from ${num(total, locale)} verified ${short} specialists.`}
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 min-[1400px]:grid-cols-4">
              {rows.map((doc) => (
                <DoctorCard key={doc.id} doctor={doc} helpline={settings.helpline} locale={locale} d={d} />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <p className="mb-3 text-ink-faint">
              {locale === "bn"
                ? `${placeName} এখনো ${short} বিশেষজ্ঞ যুক্ত হয়নি।`
                : `No ${short} specialists in ${district.name} yet.`}
            </p>
            <Link href={L(`/districts/${slug}/doctors`)} className="font-semibold text-brand-600">
              {locale === "bn" ? `${placeName} সব ডাক্তার দেখুন` : `See all doctors in ${district.name}`}
            </Link>
          </div>
        )}

        {/* Down into the thana pages for this same specialty, and sideways to
            the other specialties of this district. Both are coverage-checked,
            so no link here lands on an empty page. */}
        <LinkCloud
          title={d.hub_area_specialties_title_tpl.replace("{a}", district.name)}
          description={d.hub_areas_desc}
          items={areasWithSpec}
          href={(a) => L(`/specialties/${spec.slug}/${a.slug}`)}
          locale={locale}
          countSuffix={d.doctors_unit}
          limit={12}
        />

        <LinkCloud
          title={d.hub_specialties_title_tpl.replace("{d}", district.name)}
          description={d.hub_specialties_desc}
          items={hub.specialties.filter((s) => s.slug !== spec.slug)}
          href={(s) => L(`/districts/${slug}/${s.slug}`)}
          locale={locale}
          countSuffix={d.doctors_unit}
          limit={30}
          moreHref={L(`/districts/${slug}/doctors`)}
          moreLabel={d.hub_all_district_doctors_tpl.replace("{d}", district.name)}
        />

        {faqs.length > 0 && (
          <section className="mt-4 rounded-2xl border border-line bg-white p-5 sm:p-6">
            <h2 className="mb-4 mt-0 font-heading text-[19px] font-bold text-ink sm:text-[22px]">
              {d.district_faq_title}
            </h2>
            <FaqAccordion faqs={faqs} />
          </section>
        )}
      </div>
    </div>
  );
}
