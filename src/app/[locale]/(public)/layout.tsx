import { Suspense } from "react";
import { headers } from "next/headers";
import Loading from "./loading";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/public/navbar";
import { BottomNav } from "@/components/public/bottom-nav";
import { Footer } from "@/components/public/footer";
import { GeoPrompt } from "@/components/public/geo-prompt";
import { RecaptchaGuard } from "@/components/public/recaptcha";
import { getSettings } from "@/lib/settings";
import { getDistrictsForGeo, resolveDisplayDistrict } from "@/lib/data";
import { NoDoctorsNotice } from "@/components/public/no-doctors-notice";
import { withPossessive } from "@/lib/bn";
import { detectArea, haversineKm, type GeoDistrict } from "@/lib/geo";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";
import { JsonLd } from "@/components/json-ld";
import { ldOrganization, ldWebsite } from "@/lib/seo-utils";
import { getDict } from "@/lib/dict";
import { t, isLocale, type Locale } from "@/lib/i18n";
import { BookingProvider } from "@/components/public/booking-context";
import { LocaleScrollRestore } from "@/components/public/locale-scroll-restore";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const h = await headers();
  const ip = h.get("x-debug-ip") ?? "0.0.0.0";

  const [settings, districts, geo, recaptchaSiteKey] = await Promise.all([
    getSettings(),
    getDistrictsForGeo() as Promise<GeoDistrict[]>,
    detectArea(),
    getRecaptchaSiteKey(),
  ]);
  const d = getDict(locale);
  const brand = t(settings.brand_name, locale);

  // Only when the visitor answered the prompt themselves AND that answer had
  // to be substituted. We never nag about an IP guess being empty — they did
  // not choose it, so there is nothing for them to reconcile.
  const display = await resolveDisplayDistrict(geo, locale);
  const chosenDistrictName = geo.source === "district" ? t(geo.districtName, locale) : "";
  const showNoDoctorsNotice = Boolean(
    display?.substituted && chosenDistrictName && display.name
  );
  const noDoctorsMessage = showNoDoctorsNotice
    ? d.geo_no_doctors
        .replace("{a}", chosenDistrictName)
        .replace("{b}", locale === "bn" ? withPossessive(display!.name) : display!.name)
    : "";

  // Order the district list by the IP hint so the visitor's own district is
  // usually the first thing they see — the hint is unreliable enough to be a
  // bad *answer* but perfectly good as a *sort key*. With no usable
  // coordinates we fall back to the curated order from the DB.
  const isIpGuess = geo.source === "ip-name" || geo.source === "ip-nearest";
  const hintLat = isIpGuess ? geo.lat : null;
  const hintLng = isIpGuess ? geo.lng : null;

  const rankedDistricts =
    hintLat !== null && hintLng !== null
      ? districts
          .map((x) => ({
            x,
            // Districts with no coords sort last rather than to the equator.
            dist:
              x.lat !== null && x.lng !== null
                ? haversineKm(hintLat, hintLng, x.lat, x.lng)
                : Number.POSITIVE_INFINITY,
          }))
          .sort((a, b) => a.dist - b.dist)
          .map(({ x }, i) => ({
            slug: x.slug,
            name: x.name.bn || x.name.en || x.slug,
            nameEn: x.name.en ?? null,
            doctorCount: x.doctorCount,
            nearby: i < 3,
          }))
      : districts.map((x) => ({
          slug: x.slug,
          name: x.name.bn || x.name.en || x.slug,
          nameEn: x.name.en ?? null,
          doctorCount: x.doctorCount,
          nearby: false,
        }));

  return (
    <BookingProvider>
      <LocaleScrollRestore />
      <div className="min-h-screen bg-page">
        <JsonLd
          data={[
            ldOrganization({ brandName: brand, helpline: settings.helpline, logoUrl: settings.logo_url }),
            ldWebsite(brand, locale),
          ]}
        />
        <Navbar
          locale={locale}
          d={d}
          helplineDisplay={locale === "bn" ? settings.helpline_bn : settings.helpline}
          helpline={settings.helpline}
          brandName={brand}
          logoDesktopUrl={settings.logo_desktop_url}
          logoMobileUrl={settings.logo_mobile_url}
        />
        <GeoPrompt
          hasDistrict={geo.source === "district" || geo.source === "cookie"}
          districtName={isIpGuess ? t(geo.districtName, locale) || null : null}
          districts={rankedDistricts}
          d={d}
        />
        <main><Suspense fallback={<Loading />}>{children}</Suspense></main>
        <Footer locale={locale} />
        {/* Spacer so the last inch of every page stays visible above the
            fixed bottom tab bar on mobile; noop on desktop. */}
        <div className="h-16 min-[1060px]:hidden" aria-hidden />
        <BottomNav locale={locale} d={d} />
        {showNoDoctorsNotice && (
          <NoDoctorsNotice
            message={noDoctorsMessage}
            pairKey={`${geo.districtSlug ?? ""}|${display?.slug ?? ""}`}
          />
        )}
        <RecaptchaGuard siteKey={recaptchaSiteKey} />
        </div>
    </BookingProvider>
  );
}
