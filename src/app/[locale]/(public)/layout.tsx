import { notFound } from "next/navigation";
import { Navbar } from "@/components/public/navbar";
import { BottomNav } from "@/components/public/bottom-nav";
import { Footer } from "@/components/public/footer";
import { GeoShell, type GeoShellDistrict } from "@/components/public/geo-shell";
import { LocationProvider, type ProviderDistrict } from "@/components/public/location-provider";
import { RecaptchaGuard } from "@/components/public/recaptcha";
import { getSettings } from "@/lib/settings";
import { getDistrictsForGeo } from "@/lib/data";
import { type GeoDistrict } from "@/lib/geo";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";
import { JsonLd } from "@/components/json-ld";
import { ldOrganization, ldWebsite, brandIdentity } from "@/lib/seo-utils";
import { getDict } from "@/lib/dict";
import { t, isLocale, type Locale } from "@/lib/i18n";
import { BookingProvider } from "@/components/public/booking-context";
import { LocaleScrollRestore } from "@/components/public/locale-scroll-restore";

// This layout is fully static/ISR: every value below comes from an
// `unstable_cache`d reader and is identical for every visitor, so the rendered
// HTML can sit in Vercel's and Cloudflare's caches.
//
// It used to call detectArea(), which reads cookies() + headers(). That single
// call made all 24 public routes `ƒ Dynamic`. Everything visitor-specific it
// used to compute — the district prompt, the "nearby" ordering, the
// substitution notice — now lives in <GeoShell>, below <LocationProvider>.
//
// Do not add cookies(), headers(), or detectArea() here.

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

  const [settings, districts, recaptchaSiteKey] = await Promise.all([
    getSettings(),
    getDistrictsForGeo() as Promise<GeoDistrict[]>,
    getRecaptchaSiteKey(),
  ]);
  const d = getDict(locale);
  const brand = t(settings.brand_name, locale);
  // Site identity for search engines — same on every page and in both locales,
  // unlike `brand` which is on-page copy. See brandIdentity() in seo-utils.ts.
  const identity = brandIdentity(settings.site_name, settings.brand_name);

  // One shared, visitor-independent projection of the district list. The
  // browser re-orders it by proximity once it knows where the visitor is; the
  // server ships it in the curated DB order that every visitor and crawler
  // sees identically.
  const districtOptions: GeoShellDistrict[] = districts.map((x) => ({
    slug: x.slug,
    name: x.name.bn || x.name.en || x.slug,
    nameEn: x.name.en ?? null,
    doctorCount: x.doctorCount,
    lat: x.lat,
    lng: x.lng,
  }));

  const providerDistricts: ProviderDistrict[] = districts.map((x) => ({
    slug: x.slug,
    name: x.name.bn || x.name.en || x.slug,
    lat: x.lat,
    lng: x.lng,
  }));

  return (
    <LocationProvider districts={providerDistricts} locale={locale}>
      <BookingProvider>
        <LocaleScrollRestore />
        <div className="min-h-screen bg-page">
          <JsonLd
            data={[
              ldOrganization({ identity, helpline: settings.helpline, logoUrl: settings.logo_url }),
              ldWebsite(identity, locale),
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
          <GeoShell districts={districtOptions} locale={locale} d={d} />
          {/* No manual <Suspense> here. ./loading.tsx already gives this segment
              a Suspense boundary, and Next places it INSIDE error.tsx's boundary.
              Wrapping children by hand put the fallback outside the error
              boundary instead, so a page that threw left the visitor staring at
              the loading skeleton forever rather than seeing the error page. */}
          <main>{children}</main>
          <Footer locale={locale} />
          {/* Spacer so the last inch of every page stays visible above the
              fixed bottom tab bar on mobile; noop on desktop. */}
          <div className="h-16 min-[1060px]:hidden" aria-hidden />
          <BottomNav locale={locale} d={d} />
          <RecaptchaGuard siteKey={recaptchaSiteKey} />
        </div>
      </BookingProvider>
    </LocationProvider>
  );
}
