import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { SpecialtySlider } from "@/components/public/specialty-slider";
import { getSpecialtyBySlug, getSpecialties, getFaqs, searchDoctors } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { detectArea } from "@/lib/geo";
import { buildMetadata, findRedirect } from "@/lib/seo";
import { ldFaq } from "@/lib/seo-utils";
import { getDict } from "@/lib/dict";
import { t, isLocale, localeHref, type Locale } from "@/lib/i18n";
import { SpecialtyDoctorListClient } from "@/components/public/specialty-doctor-list-client";

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ q?: string; page?: string; perPage?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};

  const [spec, geo] = await Promise.all([getSpecialtyBySlug(slug, locale), detectArea()]);
  if (!spec) return {};

  const districtName = t(geo.districtName, locale) || (locale === "bn" ? "খুলনা" : "Khulna");
  const isIpDetected = geo.source === "ip-name" || geo.source === "ip-nearest";

  const title = spec.meta_title ? ml(spec.meta_title, locale) :
    isIpDetected
      ? (locale === "bn" ? `আপনার সবচেয়ে কাছের সেরা ${spec.name} ডাক্তার` : `Best ${spec.name} Doctors Near You`)
      : (locale === "bn" ? `${districtName}র সেরা ${spec.name} ডাক্তার` : `Best ${spec.name} Doctors in ${districtName}`);
  
  const description = spec.meta_description ? ml(spec.meta_description, locale) :
    isIpDetected
      ? (locale === "bn" ? `আপনার সবচেয়ে কাছের অভিজ্ঞ ও যাচাইকৃত ${spec.name} বিশেষজ্ঞ ডাক্তারদের তালিকা, চেম্বারের ঠিকানা, সময়সূচি ও ভিজিট ফি।` : `Experienced, verified ${spec.name} specialists near you with chamber addresses, schedules and visit fees.`)
      : (locale === "bn" ? `${districtName}র অভিজ্ঞ ও যাচাইকৃত ${spec.name} বিশেষজ্ঞ ডাক্তারদের তালিকা, চেম্বারের ঠিকানা, সময়সূচি ও ভিজিট ফি।` : `Experienced, verified ${spec.name} specialists in ${districtName} with chamber addresses, schedules and visit fees.`);

  return buildMetadata({
    locale,
    path: `/specialties/${spec.slug}`,
    title,
    description,
    ogTitle: title,
    noTemplate: Boolean(spec.meta_title),
  });
}

const ml = (v: any, locale: Locale) => t(v, locale);

export default async function SpecialtyPage({ params, searchParams }: Props) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);
  const sp = await searchParams;
  const h = await headers();
  const debugIp = h.get('x-debug-ip');

  const [spec, geo] = await Promise.all([getSpecialtyBySlug(slug, locale), detectArea()]);
  if (!spec) {
    const hit = await findRedirect(`/specialties/${slug}`);
    if (hit) {
      const target = L(hit.to_path);
      if (hit.permanent) permanentRedirect(target);
      redirect(target);
    }
    notFound();
  }

  const [settings, allSpecialties, faqs, initialDoctorData] = await Promise.all([
    getSettings(),
    getSpecialties(locale),
    getFaqs("specialty", spec.id, locale),
    searchDoctors({
      specialty: slug,
      page: 1,
      perPage: 12,
      q: sp.q,
      preferAreaId: geo.areaId,
      preferDistrictId: geo.districtId,
      preferLat: geo.lat,
      preferLng: geo.lng,
    }, locale),
  ]);

  const suggestedSpecialties = allSpecialties.filter((s) => s.id !== spec.id);

  const districtName = t(geo.districtName, locale) || (locale === "bn" ? "খুলনা" : "Khulna");
  const isIpDetected = geo.source === "ip-name" || geo.source === "ip-nearest";

  const pageTitle = isIpDetected
    ? (locale === "bn" ? `আপনার সবচেয়ে কাছের সেরা ${spec.name} ডাক্তার` : `Best ${spec.name} Doctors Near You`)
    : (locale === "bn" ? `${districtName}র সেরা ${spec.name} ডাক্তার` : `Best ${spec.name} Doctors in ${districtName}`);

  const listTitle = locale === "bn"
    ? `${districtName}র ${spec.name} ডাক্তারদের তালিকা`
    : `List of ${spec.name} Doctors in ${districtName}`;

  return (
    <div>
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
          <h1 className="mb-3.5 font-heading text-[clamp(28px,4.5vw,40px)] font-bold text-ink">{pageTitle}</h1>
          {spec.intro && (
            <p className="m-0 max-w-[760px] text-base leading-[1.8] text-ink-mute">{spec.intro}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-site px-5 pb-5 pt-9">
        <h2 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">{listTitle}</h2>
        <SpecialtyDoctorListClient
          locale={locale}
          settings={settings}
          initialDoctors={initialDoctorData.rows}
          initialTotal={initialDoctorData.total}
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
    </div>
  );
}
