import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { getAreaBySlugs, getSpecialties, getFaqs, searchDoctors } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { detectArea } from "@/lib/geo";
import { buildMetadata, findRedirect } from "@/lib/seo";
import { ldFaq } from "@/lib/seo-utils";
import { getDict } from "@/lib/dict";
import { isLocale, localeHref, type Locale } from "@/lib/i18n";
import { AreaDoctorListClient } from "@/components/public/area-doctor-list-client";

type Props = { params: Promise<{ locale: string; district: string, area: string }>; searchParams: Promise<{ page?: string; perPage?: string; q?: string, specialty?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, district, area: areaSlug } = await params;
  if (!isLocale(locale)) return {};
  const area = await getAreaBySlugs(district, areaSlug, locale);
  if (!area) return {};

  const path = `/area/doctors/${district}/${areaSlug}`;
  return buildMetadata({
    locale,
    path,
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

export default async function AreaPage({ params, searchParams }: Props) {
  const { locale: raw, district, area: areaSlug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const sp = await searchParams;

  const geo = await detectArea();

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
  const [settings, allSpecialties, faqs, initialDoctorData] = await Promise.all([
    getSettings(),
    getSpecialties(locale),
    getFaqs("area", area.id, locale),
    searchDoctors({
      area: area.slug,
      page: 1,
      perPage: 12,
      q: sp.q,
      specialty: sp.specialty,
      preferAreaId: geo.areaId,
      preferDistrictId: geo.districtId,
      preferLat: geo.lat,
      preferLng: geo.lng,
    }, locale),
  ]);

  const pageTitle = locale === "bn" ? `${area.name}-এর ডাক্তার ও চেম্বার` : `Doctors in ${area.name}`;
  
  return (
    <div>
      {faqs.length > 0 && <JsonLd data={ldFaq(faqs)} />}

      <div className="[background:linear-gradient(180deg,#FFF7ED,#F8FAFC)]">
        <div className="mx-auto max-w-site px-5 pb-10 pt-[26px]">
          <Breadcrumbs
            locale={locale}
            items={[
              { name: d.breadcrumb_home, path: "/" },
              { name: d.area_label, path: "/area" },
              { name: area.district, path: `/area?district=${area.district_slug}`},
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
