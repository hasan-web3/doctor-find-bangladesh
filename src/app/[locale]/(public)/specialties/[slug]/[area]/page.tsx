import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { DoctorCard } from "@/components/public/doctor-card";
import { LinkCloud } from "@/components/public/link-cloud";
import { getSpecialtyBySlug, getAreaBySlug, searchDoctors, countDoctorsFor } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { buildMetadata, findRedirect } from "@/lib/seo";
import { Pagination } from "@/components/public/pagination";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, type Locale } from "@/lib/i18n";

// ISR: hub; on-demand revalidated on mutation. 24h is the no-change ceiling.
// Deliberately still 24h. Listing pages are NOT purged when a doctor changes
// (see the KNOWN GAP note in src/lib/revalidate.ts) so this timer is the only
// thing that surfaces a new doctor here. Do not raise it until that is fixed.
export const revalidate = 86400;

// Empty list = prebuild nothing, but mark the route statically generatable so
// Next serves it as ISR: first request renders and caches, later requests hit
// the cache. Without this a dynamic segment is re-rendered on every request.
export function generateStaticParams() {
  return [];
}


// The combination "money pages": /specialties/neurology/khalishpur
// See the note in ../../../areas/page.tsx: no searchParams server-side, or
// the route renders per request. Pagination is applied client-side.
type Props = { params: Promise<{ locale: string; slug: string; area: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug, area } = await params;
  if (!isLocale(locale)) return {};
  const [spec, areaRow] = await Promise.all([getSpecialtyBySlug(slug, locale), getAreaBySlug(area, locale)]);
  if (!spec || !areaRow) return {};

  // The long-tail combo pages: specialties × thanas is tens of thousands of
  // URLs and most have no doctors. noindex until this exact pairing does.
  const doctorCount = await countDoctorsFor({ specialty: spec.slug, area: areaRow.slug });

  const short = spec.name.split(" (")[0];
  // The district this thana belongs to. It used to be the literal string
  // "Khulna" in the title, the description, the OG subtitle, the <h1> and the
  // intro paragraph — so a Dhaka thana published as "Cardiology Doctors in
  // Dhanmondi, Khulna" across every one of those fields. `getAreaBySlug`
  // already carries the real district name, so it is simply read here; when a
  // thana has no district linked the district clause drops out of the sentence.
  const district = areaRow.district || "";
  const districtSuffix = district ? `, ${district}` : "";

  return buildMetadata({
    locale,
    path: `/specialties/${spec.slug}/${areaRow.slug}`,
    noindex: doctorCount === 0,
    title: locale === "bn"
      ? `${areaRow.name} এলাকার ${short} ডাক্তার${districtSuffix}`
      : `${short} Doctors in ${areaRow.name}${districtSuffix}`,
    description: locale === "bn"
      ? `${areaRow.name}${districtSuffix} এর অভিজ্ঞ ${spec.name} বিশেষজ্ঞ ডাক্তারদের তালিকা। চেম্বারের ঠিকানা, সময়সূচি ও ভিজিট ফি দেখে সহজে অ্যাপয়েন্টমেন্ট নিন।`
      : `Experienced ${spec.name} specialists in ${areaRow.name}${districtSuffix}. See chamber addresses, schedules and fees, then book easily.`,
    ogTitle: locale === "bn" ? `${areaRow.name}র ${short} ডাক্তার` : `${short} Doctors in ${areaRow.name}`,
    ogSubtitle: district,
  });
}

export default async function SpecialtyAreaPage({ params }: Props) {
  const { locale: raw, slug, area } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);
  const [spec, areaRow] = await Promise.all([getSpecialtyBySlug(slug, locale), getAreaBySlug(area, locale)]);
  if (!spec || !areaRow) {
    const hit = await findRedirect(`/specialties/${slug}/${area}`);
    if (hit) {
      const target = L(hit.to_path);
      if (hit.permanent) permanentRedirect(target);
      redirect(target);
    }
    notFound();
  }
  const page = 1;
  const perPageOptions = [12, 24, 48, 96];
  const perPage = 12;
  const sanitizedPerPage = perPageOptions.includes(perPage) ? perPage : 12;

  const [settings, { rows, total }] = await Promise.all([
    getSettings(),
    // Scoped to one thana, so the curated order of the district that thana
    // belongs to applies — same rule as the plain thana page.
    searchDoctors({
      specialty: spec.slug,
      area: areaRow.slug,
      page,
      perPage: sanitizedPerPage,
      priorityDistrictId: areaRow.district_id ?? null,
    }, locale),
  ]);
  const totalPages = Math.ceil(total / sanitizedPerPage);
  const short = spec.name.split(" (")[0];

  // Real district name, never a hard-coded city. See generateMetadata above.
  const district = areaRow.district || "";
  const districtSuffix = district ? `, ${district}` : "";

  const pageTitle = locale === "bn"
    ? `${areaRow.name} এলাকার ${short} ডাক্তার${districtSuffix}`
    : `${short} Doctors in ${areaRow.name}${districtSuffix}`;
  const intro = locale === "bn"
    ? `${areaRow.name}${districtSuffix} এলাকায় ${spec.name} বিশেষজ্ঞ অভিজ্ঞ ডাক্তারদের তালিকা, চেম্বারের ঠিকানা ও সময়সূচি এক জায়গায়। আপনার কাছের ডাক্তার বেছে নিয়ে সহজে অ্যাপয়েন্টমেন্ট নিন।`
    : `A complete list of experienced ${spec.name} specialists in ${areaRow.name}${districtSuffix}, with chamber addresses and schedules. Pick a doctor near you and book easily.`;

  return (
    <div>
      <div className="[background:linear-gradient(180deg,#F0FDFA,#F8FAFC)]">
        <div className="mx-auto max-w-site px-5 pb-10 pt-[26px]">
          {/* The district crumb is what links this combination page back up to
              its parent listing. Without it the page's only outbound link was
              the specialty hub, which made the combination pages a dead end in
              both directions. */}
          <Breadcrumbs
            locale={locale}
            items={[
              { name: d.breadcrumb_home, path: "/" },
              ...(areaRow.district_slug && district
                ? [{ name: district, path: `/districts/${areaRow.district_slug}/doctors` }]
                : []),
              { name: spec.name, path: `/specialties/${spec.slug}` },
              { name: areaRow.name },
            ]}
          />
          <h1 className="mb-3.5 font-heading text-[clamp(28px,4.5vw,40px)] font-bold text-ink">{pageTitle}</h1>
          <p className="m-0 max-w-[760px] text-base leading-[1.8] text-ink-mute">{intro}</p>
        </div>
      </div>

      <div className="mx-auto max-w-site px-5 py-9">
        {rows.length > 0 ? (
          <>
            {/* Same grid as every other doctor listing (specialty, thana,
                hospital). This page was the one that stopped at three columns,
                so a wide screen left a column of empty space beside the cards
                while its sibling pages filled it. */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 min-[1400px]:grid-cols-4">
              {rows.map((doc) => (
                <DoctorCard key={doc.id} doctor={doc} helpline={settings.helpline} locale={locale} d={d} />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              locale={locale}
              perPage={sanitizedPerPage}
              showPerPageSelector
            />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
            <p className="mb-3 text-ink-faint">
              {locale === "bn"
                ? `${areaRow.name} ${d.no_combo_doctors_1} ${short} ${d.no_combo_doctors_2}`
                : `${areaRow.name} ${d.no_combo_doctors_1} ${short} ${d.no_combo_doctors_2}`}
            </p>
            <Link href={L(`/specialties/${spec.slug}`)} className="font-semibold text-brand-600">
              {d.see_all_spec_prefix} {short} {d.see_all_spec_suffix}
            </Link>
          </div>
        )}

        {/* Sideways links out of the combination page: the thana's full doctor
            list and the district's. Both destinations are guaranteed to have
            content, since this page only renders for a thana that has doctors. */}
        <LinkCloud
          title={d.hub_related_title}
          items={[
            ...(areaRow.district_slug
              ? [{
                  slug: `${areaRow.district_slug}/${areaRow.slug}`,
                  name: d.hub_all_area_doctors_tpl.replace("{a}", areaRow.name),
                  doctor_count: 0,
                }]
              : []),
          ]}
          href={(x) => L(`/area/doctors/${x.slug}`)}
          locale={locale}
          countSuffix={d.doctors_unit}
          headingLevel="h2"
        />
      </div>
    </div>
  );
}
