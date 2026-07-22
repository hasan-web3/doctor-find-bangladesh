import { Suspense } from "react";
import { headers } from "next/headers";
import Loading from "./loading";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/public/navbar";
import { BottomNav } from "@/components/public/bottom-nav";
import { Footer } from "@/components/public/footer";
import { GeoBanner } from "@/components/public/geo-banner";
import { RecaptchaGuard } from "@/components/public/recaptcha";
import { getSettings } from "@/lib/settings";
import { getAreas, type Area } from "@/lib/data";
import { detectArea } from "@/lib/geo";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";
import { JsonLd } from "@/components/json-ld";
import { ldOrganization, ldWebsite } from "@/lib/seo-utils";
import { getDict } from "@/lib/dict";
import { t, isLocale, type Locale } from "@/lib/i18n";
import { BookingProvider } from "@/components/public/booking-context";

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

  const [settings, areas, geo, recaptchaSiteKey] = await Promise.all([
    getSettings(),
    getAreas(locale) as Promise<Area[]>,
    detectArea(),
    getRecaptchaSiteKey(),
  ]);
  const d = getDict(locale);
  const brand = t(settings.brand_name, locale);

  return (
    <BookingProvider>
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
        />
        <GeoBanner
          areaName={geo.source === "ip-name" || geo.source === "ip-nearest" ? t(geo.areaName, locale) : null}
          areas={areas.map((a) => ({ slug: a.slug, name: a.name }))}
          d={d}
        />
        <main><Suspense fallback={<Loading />}>{children}</Suspense></main>
        <Footer locale={locale} />
        {/* Spacer so the last inch of every page stays visible above the
            fixed bottom tab bar on mobile; noop on desktop. */}
        <div className="h-16 min-[1060px]:hidden" aria-hidden />
        <BottomNav locale={locale} d={d} />
        <RecaptchaGuard siteKey={recaptchaSiteKey} />
        </div>
    </BookingProvider>
  );
}
