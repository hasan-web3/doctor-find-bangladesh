import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { JsonLd } from "@/components/json-ld";
import { DoctorCard } from "@/components/public/doctor-card";
import { HeroSlider } from "@/components/public/hero-slider";
import { SearchBar } from "@/components/public/search-bar";
import { getEnabledConfig } from "@/lib/integrations";

// Below-the-fold client components — split into their own chunks so they don't
// share the critical path with the hero/search bar hydration. Each still SSRs
// (server HTML ships identical to before), only their JS is deferred.
const StatsCounter = dynamic(() =>
  import("@/components/public/stats-counter").then((m) => m.StatsCounter),
);
const FaqAccordion = dynamic(() =>
  import("@/components/public/faq-accordion").then((m) => m.FaqAccordion),
);
const TestimonialSlider = dynamic(() =>
  import("@/components/public/testimonial-slider").then((m) => m.TestimonialSlider),
);
const AreaMap = dynamic(() =>
  import("@/components/public/area-map").then((m) => m.AreaMap),
);
import {
  getSpecialties, getAreas, getFeaturedDoctors, searchHospitals,
  getHeroSlides, getFaqs, getTestimonials, getBlogPosts, searchDoctors,
  getDistrictsForSearch, getThanasForSearch, type Area,
} from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { detectArea, haversineKm } from "@/lib/geo";
import { buildMetadata } from "@/lib/seo";
import { ldFaq } from "@/lib/seo-utils";
import { getDict } from "@/lib/dict";
import { withPossessive as bnPossessive } from "@/lib/bn";
import { t, isLocale, localeHref, num, date as fmtDate, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const settings = await getSettings();
  return buildMetadata({
    locale: raw,
    path: "/",
    title: t(settings.seo_default_title, raw),
    description: t(settings.seo_default_description, raw),
    ogTitle: t(settings.brand_name, raw),
    ogSubtitle: raw === "bn" ? "খুলনার বিশ্বস্ত ডাক্তার ডিরেক্টরি" : "Khulna's trusted doctor directory",
    noTemplate: true,
  });
}

const TINTS = [
  { bg: "#F0FDFA", fg: "#0F766E" },
  { bg: "#ECFDF5", fg: "#059669" },
  { bg: "#FFF7ED", fg: "#EA580C" },
  { bg: "#EFF6FF", fg: "#2563EB" },
  { bg: "#FDF4FF", fg: "#A21CAF" },
];

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-9 text-center">
      <div className="mb-2 text-sm font-bold tracking-wide text-brand-600">{eyebrow}</div>
      <h2 className="m-0 font-heading text-[clamp(26px,3.5vw,32px)] font-bold text-ink">{title}</h2>
    </div>
  );
}

export default async function HomePage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);

  const [
    settings, specialties, areas, slides, faqs, testimonials, hospitalData, blogResult,
    geo, mapsConfig, searchDistricts, searchThanas,
  ] = await Promise.all([
    getSettings(), getSpecialties(locale), getAreas(locale) as Promise<Area[]>, getHeroSlides(locale),
    getFaqs("home", null, locale), getTestimonials(locale), searchHospitals({}, locale),
    getBlogPosts(locale, { perPage: 3 }), detectArea(), getEnabledConfig("google_maps"),
    getDistrictsForSearch(), getThanasForSearch(),
  ]);

  const blog = blogResult.rows;
  const hospitals = hospitalData.rows;

  // Geo-preferred featured doctors: matching area first, sorted by proximity.
  const featured = geo.areaId
    ? (await searchDoctors(
        { preferAreaId: geo.areaId, preferLat: geo.lat, preferLng: geo.lng, perPage: 12 },
        locale
      )).rows
    : await getFeaturedDoctors(locale, 12);

  // Dynamic titles and subtitles.
  // If we have a detected district, we use that (e.g. "খুলনার" / "Khulna's").
  // If not, we default to "আপনার এলাকার" (Bangla) / "your area's" or "your area" (English) as requested.
  const geoDistrictName = geo.districtName
    ? (locale === "bn" ? geo.districtName.bn : geo.districtName.en) || null
    : null;

  const heroBadgeText = geoDistrictName
    ? (locale === "bn"
        ? `${bnPossessive(geoDistrictName)} #১ ডাক্তার ডিরেক্টরি`
        : `${geoDistrictName}'s #1 Doctor Directory`)
    : (locale === "bn"
        ? "আপনার এলাকার #১ ডাক্তার ডিরেক্টরি"
        : "Your Area's #1 Doctor Directory");

  const heroSub = geoDistrictName
    ? (locale === "bn"
        ? `${bnPossessive(geoDistrictName)} সেরা বিশেষজ্ঞ ডাক্তার খুঁজুন, সহজে অ্যাপয়েন্টমেন্ট নিন।`
        : `Find the best specialist doctors in ${geoDistrictName} and book appointments easily.`)
    : (locale === "bn"
        ? "আপনার এলাকার সেরা বিশেষজ্ঞ ডাক্তার খুঁজুন, সহজে অ্যাপয়েন্টমেন্ট নিন।"
        : "Find the best specialist doctors in your area and book appointments easily.");

  const areaSectionSub = geoDistrictName
    ? (locale === 'bn'
        ? `${bnPossessive(geoDistrictName)} প্রতিটি এলাকার যাচাইকৃত ডাক্তার ও চেম্বারের তথ্য এক জায়গায়।`
        : `Verified doctor and chamber information for every area of ${geoDistrictName}.`
      )
    : (locale === 'bn'
        ? "আপনার এলাকার প্রতিটি এলাকার যাচাইকৃত ডাক্তার ও চেম্বারের তথ্য এক জায়গায়।"
        : "Verified doctor and chamber information for every area in your location."
      );

  const featuredSectionTitle = geoDistrictName
    ? (locale === "bn"
        ? `${bnPossessive(geoDistrictName)} জনপ্রিয় ও যাচাইকৃত ডাক্তার`
        : `Popular & verified doctors in ${geoDistrictName}`)
    : (locale === "bn"
        ? "আপনার এলাকার জনপ্রিয় ও যাচাইকৃত ডাক্তার"
        : "Popular & verified doctors in your area");

  const fordocSub = geoDistrictName
    ? (locale === "bn"
        ? `প্রতিদিন ${bnPossessive(geoDistrictName)} হাজারো রোগী ডক্টরবন্ধুতে ডাক্তার খোঁজেন। আপনার প্রোফাইল ভেরিফায়েড ও ফিচার্ড করে বেশি রোগীর কাছে পৌঁছান।`
        : `Thousands of patients in ${geoDistrictName} search for doctors on DoctorBondhu every day. Get verified and featured to reach more of them.`)
    : (locale === "bn"
        ? "প্রতিদিন আপনার এলাকার হাজারো রোগী ডক্টরবন্ধুতে ডাক্তার খোঁজেন। আপনার প্রোফাইল ভেরিফায়েড ও ফিচার্ড করে বেশি রোগীর কাছে পৌঁছান।"
        : "Thousands of patients in your area search for doctors on DoctorBondhu every day. Get verified and featured to reach more of them.");

  const displayedAreas = (
    geo.districtId
      ? areas.filter(a => a.district_id === geo.districtId)
      : areas
  ).slice(0, 6);

  const shuffledSpecialties = [...specialties].sort(() => Math.random() - 0.5);
  const shuffledHeroSpecialties = [...specialties].sort(() => Math.random() - 0.5);

  const hospitalSectionTitle = geoDistrictName
    ? (locale === "bn"
        ? `${bnPossessive(geoDistrictName)} পরিচিত হাসপাতাল`
        : `Well-known hospitals in ${geoDistrictName}`)
    : (locale === "bn"
        ? "আপনার এলাকার পরিচিত হাসপাতাল"
        : "Well-known hospitals in your area");

  let sortedHospitals = [...hospitals];
  if (geo.lat && geo.lng) {
    sortedHospitals.sort((a, b) => {
      if (a.lat && a.lng && b.lat && b.lng) {
        const distA = haversineKm(geo.lat!, geo.lng!, a.lat, a.lng);
        const distB = haversineKm(geo.lat!, geo.lng!, b.lat, b.lng);
        return distA - distB;
      }
      return 0;
    });
  }
  const displayedHospitals = sortedHospitals.slice(0, 6);

  // Find approximate coordinates of the matched area, defaulting to Khulna city center
  const matchedArea = geo.areaId ? areas.find((a) => a.id === geo.areaId) : null;
  const initialLat = matchedArea?.lat ?? 22.8456;
  const initialLng = matchedArea?.lng ?? 89.5403;

  const STEPS = [
    { no: num(1, locale), title: d.step1_title, text: d.step1_text, icon: "search" },
    { no: num(2, locale), title: d.step2_title, text: d.step2_text, icon: "user" },
    { no: num(3, locale), title: d.step3_title, text: d.step3_text, icon: "calendar" },
  ];
  const FEATURES = [
    { title: d.why1_title, text: d.why1_text, icon: "shield", tint: 0 },
    { title: d.why2_title, text: d.why2_text, icon: "pin", tint: 2 },
    { title: d.why3_title, text: d.why3_text, icon: "calendar", tint: 1 },
    { title: d.why4_title, text: d.why4_text, icon: "phone", tint: 3 },
  ];
  const dynamicFordocBenefit2 = geoDistrictName
    ? (locale === "bn"
        ? `${bnPossessive(geoDistrictName)} হাজারো রোগীর কাছে পৌঁছান`
        : `Reach thousands of patients in ${geoDistrictName}`)
    : (locale === "bn"
        ? "আপনার এলাকার হাজারো রোগীর কাছে পৌঁছান"
        : "Reach thousands of patients in your area");

  const docBenefits = [d.fordoc_benefit1, dynamicFordocBenefit2, d.fordoc_benefit3, d.fordoc_benefit4];
  const helplineDisplay = locale === "bn" ? settings.helpline_bn : settings.helpline;

  return (
    <>
      {faqs.length > 0 && <JsonLd data={ldFaq(faqs)} />}

      {/* ===== HERO ===== */}
      <div className="[background:linear-gradient(180deg,#F0FDFA_0%,#F8FAFC_100%)]">
        <div className="mx-auto grid max-w-site grid-cols-1 items-center gap-10 px-5 pb-16 pt-14 min-[900px]:grid-cols-[1.1fr_.9fr]">
          {/* No opacity animation here: this column holds the LCP <h1> and
              wrapping it in animate-fadeup delays paint of the largest
              contentful element until the animation starts. */}
          <div className="relative z-20">
            <div className="mb-[18px] inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-brand-700 shadow-[0_2px_8px_rgba(13,148,136,0.08)]">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              {heroBadgeText}
            </div>
            <h1 className="mb-3.5 font-heading text-[clamp(30px,5vw,46px)] font-bold leading-[1.25] text-ink">
              {d.hero_title_1} <span className="text-brand-600">{d.hero_title_2}</span>
            </h1>
            <p className="mb-[26px] max-w-[520px] text-[17px] text-ink-mute">{heroSub}</p>
            <SearchBar
              districts={searchDistricts.map((x) => ({ slug: x.slug, name: locale === "bn" ? x.name_bn : (x.name_en || x.name_bn), name_en: x.name_en }))}
              thanas={searchThanas.map((t) => ({ slug: t.slug, name: locale === "bn" ? t.name_bn : (t.name_en || t.name_bn), name_en: t.name_en, district_slug: t.district_slug }))}
              locale={locale}
              d={d}
              preselectDistrictSlug={geo.districtSlug}
              preselectThanaSlug={geo.areaSlug}
            />
            <div className="mt-[18px] flex flex-wrap items-center gap-2">
              {shuffledHeroSpecialties.slice(0, 6).map((s) => (
                <Link
                  key={s.id}
                  href={L(`/specialties/${s.slug}`)}
                  className="rounded-full border border-brand-100 bg-white px-[13px] py-1.5 text-[13.5px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                >
                  {s.name.split(" (")[0]}
                </Link>
              ))}
            </div>
          </div>
          <HeroSlider slides={slides} verifiedLabel={d.verified_doctor} />
        </div>
      </div>

      {/* ===== STATS BAR ===== */}
      <div className="bg-brand-700">
        <StatsCounter
          stats={settings.stats.map((s) => ({ value: s.value, suffix: s.suffix, label: t(s.label, locale) }))}
          locale={locale}
        />
      </div>

      {/* ===== SPECIALTIES ===== */}
      <div className="mx-auto max-w-site px-5 py-16">
        <Reveal>
          <SectionHead eyebrow={d.sec_specialties_eyebrow} title={d.sec_specialties_title} />
        </Reveal>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 min-[900px]:grid-cols-6">
          {shuffledSpecialties.slice(0, 12).map((s, i) => {
            const tint = TINTS[s.tint % TINTS.length];
            let responsiveClass = "";
            // 9th item (index 8) - hidden on mobile, visible on sm+
            if (i === 8) responsiveClass = "hidden sm:block";
            // 10th, 11th, 12th items (index 9+) - hidden on mobile & sm, visible on min-[900px]+
            else if (i > 8) responsiveClass = "hidden min-[900px]:block";

            return (
              <Reveal key={s.id} delay={Math.min(i * 40, 300)} className={responsiveClass}>
                <Link
                  href={L(`/specialties/${s.slug}`)}
                  className="flex h-full flex-col items-center gap-2.5 rounded-2xl border border-line bg-white px-3 py-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-cardhover"
                >
                  <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px]" style={{ background: tint.bg, color: tint.fg }}>
                    <Icon name={s.icon} />
                  </span>
                  <div className="text-center">
                    <span className="text-[14.5px] font-semibold leading-tight text-ink">{s.name}</span>
                    {s.doctor_count > 0 && (
                      <div className="mt-1 text-xs font-medium text-ink-faint">{num(s.doctor_count, locale)} {d.doctors_unit}</div>
                    )}
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>

      {/* ===== FIND BY AREA ===== */}
      <div className="bg-brand-50">
        <div className="mx-auto grid max-w-site grid-cols-1 items-center gap-[30px] px-5 py-14 min-[900px]:grid-cols-2">
          <Reveal>
            <div className="mb-2 text-sm font-bold text-brand-600">{d.sec_area_eyebrow}</div>
            <h2 className="mb-3 font-heading text-[clamp(26px,3.5vw,32px)] font-bold text-ink">{d.sec_area_title}</h2>
            <p className="mb-[22px] max-w-[460px] text-base text-ink-mute">{areaSectionSub}</p>
            <div className="flex flex-wrap gap-[9px]">
              {displayedAreas.map((a) => (
                <Link
                  key={a.id}
                  href={L(`/area/doctors/${a.district_slug}/${a.slug}`)}
                  className="flex items-center gap-1.5 rounded-full border border-brand-100 bg-white px-4 py-[9px] text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-600 hover:text-white"
                >
                  <span className="text-xs">◉</span>
                  {a.name}
                </Link>
              ))}
            </div>
          </Reveal>
          <Reveal className="flex items-center justify-center">
            {mapsConfig?.api_key ? (
              <AreaMap apiKey={mapsConfig.api_key} initialLat={initialLat} initialLng={initialLng} />
            ) : (
              <div className="relative aspect-square w-full max-w-[420px] overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-[0_14px_34px_rgba(13,148,136,.12)]">
                <div className="absolute inset-0 [background:repeating-linear-gradient(0deg,transparent,transparent_28px,#F0FDFA_28px,#F0FDFA_29px),repeating-linear-gradient(90deg,transparent,transparent_28px,#F0FDFA_28px,#F0FDFA_29px)]" />
                <div className="absolute left-[18%] top-[22%] h-2 w-[70px] rotate-[18deg] rounded bg-brand-200" />
                <div className="absolute left-[40%] top-[55%] h-[9px] w-[110px] -rotate-[12deg] rounded bg-brand-300" />
                <div className="absolute left-[55%] top-[32%] h-4 w-4 rotate-45 rounded-[50%_50%_50%_0] bg-warm shadow-[0_4px_10px_rgba(249,115,22,.4)]" />
                <div className="absolute left-[28%] top-[64%] h-4 w-4 rotate-45 rounded-[50%_50%_50%_0] bg-brand-600" />
                <div className="absolute left-[70%] top-[70%] h-4 w-4 rotate-45 rounded-[50%_50%_50%_0] bg-brand-600" />
                <div className="absolute bottom-3 left-3 rounded-[10px] border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-mute">
                  {d.khulna_bd}
                </div>
              </div>
            )}
          </Reveal>
        </div>
      </div>

      {/* ===== FEATURED DOCTORS ===== */}
      <div className="mx-auto max-w-site px-5 py-16">
        <Reveal>
          <div className="mb-[30px] flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 text-sm font-bold text-brand-600">{d.sec_featured_eyebrow}</div>
              <h2 className="m-0 font-heading text-[clamp(26px,3.5vw,32px)] font-bold text-ink">{featuredSectionTitle}</h2>
            </div>
            <Link
              href={L("/doctors")}
              className="rounded-[10px] border-[1.5px] border-brand-600 bg-white px-[18px] py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              {d.view_all_doctors}
            </Link>
          </div>
        </Reveal>
        {featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 min-[1000px]:grid-cols-4">
            {featured.map((doc, i) => (
              <Reveal key={doc.id} delay={Math.min(i * 60, 240)}>
                <DoctorCard doctor={doc} helpline={settings.helpline} locale={locale} d={d} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-ink-faint">
            {d.no_doctors_yet}
          </div>
        )}
      </div>

      {/* ===== HOW IT WORKS ===== */}
      <div className="border-y border-line bg-page">
        <div className="mx-auto max-w-site px-5 py-[60px]">
          <Reveal>
            <SectionHead eyebrow={d.sec_how_eyebrow} title={d.sec_how_title} />
          </Reveal>
          <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.no} delay={i * 80}>
                <div className="relative h-full rounded-[18px] border border-line bg-white px-6 py-[30px] text-center">
                  <div className="absolute -top-4 left-1/2 flex h-[34px] w-[34px] -translate-x-1/2 items-center justify-center rounded-full bg-brand-600 font-heading text-base font-bold text-white">
                    {s.no}
                  </div>
                  <div className="mx-auto mb-4 mt-2 flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <Icon name={s.icon} size={28} />
                  </div>
                  <div className="mb-2 font-heading text-[19px] font-bold text-ink">{s.title}</div>
                  <div className="text-[15px] text-ink-mute">{s.text}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ===== WHY CHOOSE ===== */}
      <div className="mx-auto max-w-site px-5 py-16">
        <Reveal>
          <SectionHead eyebrow={d.sec_why_eyebrow} title={d.sec_why_title} />
        </Reveal>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[900px]:grid-cols-4">
          {FEATURES.map((f, i) => {
            const tint = TINTS[f.tint];
            return (
              <Reveal key={f.title} delay={i * 60}>
                <div className="h-full rounded-2xl border border-line bg-white px-[22px] py-[26px] transition-all duration-200 hover:-translate-y-1 hover:shadow-cardhover">
                  <div className="mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[14px]" style={{ background: tint.bg, color: tint.fg }}>
                    <Icon name={f.icon} />
                  </div>
                  <div className="mb-[7px] font-heading text-lg font-bold text-ink">{f.title}</div>
                  <div className="text-[14.5px] text-ink-mute">{f.text}</div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      {/* ===== HOSPITALS ===== */}
      <div className="bg-brand-50">
        <div className="mx-auto max-w-site px-5 py-14">
          <Reveal>
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="mb-2 text-sm font-bold text-brand-600">{d.sec_hosp_eyebrow}</div>
                <h2 className="m-0 font-heading text-[clamp(26px,3.5vw,32px)] font-bold text-ink">{hospitalSectionTitle}</h2>
              </div>
              <Link href={L("/hospitals")} className="rounded-[10px] border-[1.5px] border-brand-600 bg-white px-[18px] py-2.5 text-sm font-semibold text-brand-700">
                {d.view_all}
              </Link>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[900px]:grid-cols-3">
            {displayedHospitals.map((h, i) => (
              <Reveal key={h.id} delay={Math.min(i * 50, 250)}>
                <div className="flex h-full items-center gap-4 rounded-2xl border border-line bg-white p-5">
                  <div className="relative flex h-[54px] w-[54px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-brand-50 text-brand-600">
                    {h.image_url ? (
                      <Image src={h.image_url} alt={h.name} fill sizes="54px" className="object-cover" />
                    ) : (
                      <Icon name="building" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={L(`/hospitals/${h.slug}`)} className="font-heading text-base font-semibold leading-snug text-ink hover:text-brand-700">
                      {h.name}
                    </Link>
                    <div className="mt-[3px] flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-ink-faint">
                      <div className="flex items-center gap-1">
                        <span className="text-brand-600">◉</span>
                        {h.area || d.khulna}
                      </div>
                      {h.doctor_count > 0 && (
                        <div className="flex items-center gap-1 font-semibold text-ink-mute">
                          <Icon name="user" size={12} />
                          {h.doctor_count}+ {d.doctors_unit}
                        </div>
                      )}
                    </div>
                  </div>
                  <Link href={L(`/hospitals/${h.slug}`)} className="ml-auto self-end whitespace-nowrap text-[13px] font-semibold text-brand-600">
                    {d.details}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ===== CTA BANNER ===== */}
      <div className="[background:linear-gradient(120deg,#0D9488,#0F766E)]">
        <div className="mx-auto max-w-[1000px] px-5 py-[52px] text-center text-white">
          <h2 className="mb-3 font-heading text-[clamp(24px,3.5vw,32px)] font-bold">{d.cta_title}</h2>
          <p className="mb-6 text-base text-brand-100">{d.cta_sub}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={L("/doctors")} className="rounded-xl bg-accent px-7 py-3.5 text-base font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,.15)] transition-colors hover:bg-accent-hover">
              {d.book_appointment}
            </Link>
          </div>
        </div>
      </div>

      {/* ===== TESTIMONIALS ===== */}
      {testimonials.length > 0 && (
        <div className="mx-auto max-w-[1000px] px-5 py-16 text-center">
          <div className="mb-2 text-sm font-bold text-brand-600">{d.sec_testi_eyebrow}</div>
          <h2 className="mb-[34px] font-heading text-[clamp(26px,3.5vw,32px)] font-bold text-ink">{d.sec_testi_title}</h2>
          <TestimonialSlider items={testimonials} />
        </div>
      )}

      {/* ===== BLOG PREVIEW ===== */}
      {blog.length > 0 && (
        <div className="border-t border-line bg-page">
          <div className="mx-auto max-w-site px-5 py-[60px]">
            <Reveal>
              <div className="mb-[30px] flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="mb-2 text-sm font-bold text-brand-600">{d.sec_blog_eyebrow}</div>
                  <h2 className="m-0 font-heading text-[clamp(26px,3.5vw,32px)] font-bold text-ink">{d.sec_blog_title}</h2>
                </div>
                <Link href={L("/blog")} className="rounded-[10px] border-[1.5px] border-brand-600 bg-white px-[18px] py-2.5 text-sm font-semibold text-brand-700">
                  {d.view_all_articles}
                </Link>
              </div>
            </Reveal>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {blog.map((b, i) => (
                <Reveal key={b.id} delay={i * 60}>
                  <Link
                    href={L(`/blog/${b.slug}`)}
                    className="block overflow-hidden rounded-[18px] border border-line bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-cardhover"
                  >
                    <div className="relative h-[150px] overflow-hidden bg-brand-50">
                      {b.cover_url && <Image src={b.cover_url} alt={b.title} fill sizes="(max-width:640px) 100vw, 380px" className="object-cover" />}
                    </div>
                    <div className="px-5 py-[18px]">
                      <div className="mb-2 text-[12.5px] text-ink-ghost">{b.published_at ? fmtDate(b.published_at, locale) : ""}</div>
                      <div className="mb-2.5 font-heading text-[17px] font-semibold leading-normal text-ink">{b.title}</div>
                      <span className="text-sm font-semibold text-brand-600">{d.read_more}</span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== FOR DOCTORS ===== */}
      <div className="mx-auto max-w-site px-5 py-16">
        <Reveal>
          <div className="grid grid-cols-1 items-center gap-[30px] overflow-hidden rounded-3xl px-9 py-12 [background:linear-gradient(120deg,#0F172A,#134E4A)] min-[900px]:grid-cols-[1.2fr_.8fr]">
            <div>
              <div className="mb-4 inline-block rounded-full bg-brand-300/15 px-[13px] py-[5px] text-[13px] font-semibold text-brand-300">
                {d.fordoc_badge}
              </div>
              <h2 className="mb-3 font-heading text-[clamp(24px,3.4vw,30px)] font-bold text-white">{d.fordoc_title}</h2>
              <p className="mb-[22px] max-w-[520px] text-base text-[#CBD5E1]">{fordocSub}</p>
              <div className="flex flex-wrap gap-3">
                <Link href={L("/for-doctors")} className="rounded-[11px] bg-accent px-6 py-[13px] text-[15px] font-bold text-white transition-colors hover:bg-accent-hover">
                  {d.fordoc_cta}
                </Link>
                <a href={`tel:${settings.helpline}`} className="rounded-[11px] border border-white/20 bg-white/10 px-6 py-[13px] text-[15px] font-bold text-white">
                  ✆ {helplineDisplay}
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {docBenefits.map((b) => (
                <div key={b} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5">
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent text-[15px] text-white">✓</span>
                  <span className="text-[15px] font-medium text-[#E2E8F0]">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* ===== FAQ ===== */}
      {faqs.length > 0 && (
        <div className="border-t border-line bg-page">
          <div className="mx-auto max-w-[820px] px-5 py-[60px]">
            <Reveal>
              <SectionHead eyebrow={d.sec_faq_eyebrow} title={d.sec_faq_title} />
            </Reveal>
            <FaqAccordion faqs={faqs} />
          </div>
        </div>
      )}

      {/* ===== HELPLINE STRIP ===== */}
      <div className="border-t border-warm-border bg-warm-soft">
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-center gap-5 px-5 py-[34px] text-center">
          <div>
            <div className="font-heading text-xl font-bold text-warm-heavy">{d.helpline_title}</div>
            <div className="mt-0.5 text-sm text-warm-deep">{d.helpline_sub}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            <a href={`tel:${settings.helpline}`} className="flex items-center gap-2 rounded-[11px] bg-warm px-6 py-[13px] text-base font-bold text-white">
              ✆ {helplineDisplay}
            </a>
            <a
              href={`https://wa.me/${settings.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-[11px] border-[1.5px] border-[#86EFAC] bg-white px-6 py-[13px] text-base font-bold text-[#16A34A]"
            >
              {d.whatsapp}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
