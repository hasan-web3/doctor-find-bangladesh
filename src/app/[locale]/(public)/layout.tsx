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
import { enabledTools } from "@/lib/tools/registry";
import { pick as pickTool } from "@/lib/tools/copy";

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

  // The tools dropdown. Resolved from the registry plus the admin's on/off map,
  // which already arrived with `settings` above — no extra query, no extra
  // cache tag, and nothing visitor-specific, so the layout stays fully static.
  //
  // It reads the `settings` tag, which is layout-wide by design (see
  // LAYOUT_WIDE_TAGS in lib/revalidate.ts): switching a tool on or off changes
  // the navbar on every page, so purging every page is the correct response.
  const navTools = enabledTools(settings.tools_enabled).map((t) => ({
    slug: t.slug,
    label: pickTool(t.name, locale),
  }));

  return (
    <LocationProvider districts={providerDistricts} locale={locale}>
      <BookingProvider>
        <LocaleScrollRestore />
        <div className="min-h-screen bg-page">
          <JsonLd
            data={[
              // NAP + official profiles. The address and socials were rendered
              // in the footer as plain text but never declared as structured
              // data, so the local-SEO triple Google looks for (name, address,
              // phone) was only ever two thirds present.
              ldOrganization({
                identity,
                helpline: settings.helpline,
                logoUrl: settings.logo_url,
                address: t(settings.address, locale),
                email: settings.email,
                socialUrls: [settings.facebook, settings.youtube, settings.instagram],
                description: t(settings.seo_default_description, locale),
                imageUrl: settings.seo_default_og_image,
                // Topical expertise without claiming to BE a care provider.
                // See the long note above ldOrganization in seo-utils.ts.
                knowsAbout: d.org_knows_about.split("|"),
              }),
              ldWebsite(identity, locale),
            ]}
          />
          <Navbar
            locale={locale}
            d={d}
            tools={navTools}
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
          <BottomNav locale={locale} d={d} hasTools={navTools.length > 0} />
          <RecaptchaGuard siteKey={recaptchaSiteKey} />
        </div>
      </BookingProvider>
    </LocationProvider>
  );
}
