import type { Metadata } from "next";
import { headers } from "next/headers";
import { Baloo_Da_2, Hind_Siliguri, Inter } from "next/font/google";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/seo-utils";
import { t, isLocale, htmlLang, type Locale } from "@/lib/i18n";
import { getEnabledConfig } from "@/lib/integrations";
import Script from "next/script";
import "./globals.css";

const baloo = Baloo_Da_2({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

const hind = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-hind",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const gscToken = process.env.GOOGLE_SITE_VERIFICATION;
  return {
    metadataBase: new URL(siteUrl()),
    title: t(settings.seo_default_title, "bn"),
    description: t(settings.seo_default_description, "bn"),
    // GSC verification tag: paste the meta token as GOOGLE_SITE_VERIFICATION env
    // once and Next inlines it into the head of every page. Omit until the
    // token is available so we don't emit an empty content attribute.
    ...(gscToken ? { verification: { google: gscToken } } : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Locale is stamped by the middleware; admin and neutral routes fall back to bn.
  const h = await headers();
  const raw = h.get("x-locale");
  const locale: Locale = isLocale(raw) ? raw : "bn";

  const analytics = await getEnabledConfig("analytics").catch(() => null);

  // Host that serves doctor/hospital/blog images. Preconnecting saves ~360ms
  // on the LCP image handshake (measured with Lighthouse). Value comes from
  // the same env var that next.config.ts uses for the images allowlist.
  const r2Host = process.env.R2_PUBLIC_URL
    ? new URL(process.env.R2_PUBLIC_URL).origin
    : null;

  return (
    <html lang={htmlLang(locale)} className={`${baloo.variable} ${hind.variable} ${inter.variable}`}>
      <body suppressHydrationWarning={true}>
        {/* React 19 automatically hoists <link rel="preconnect"> and
            rel="dns-prefetch" into <head>. Rendering them inside <body>
            avoids clashing with Next's automatic CSS injection into a
            manually authored <head> (which was blanking out global styles). */}
        {r2Host && <link rel="preconnect" href={r2Host} crossOrigin="anonymous" />}
        {r2Host && <link rel="dns-prefetch" href={r2Host} />}
        {children}
        {analytics?.ga_id && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${analytics.ga_id}`} strategy="afterInteractive" />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${analytics.ga_id}');`}
            </Script>
          </>
        )}
        {analytics?.gtm_id && (
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
              j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
              f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${analytics.gtm_id}');`}
          </Script>
        )}
        {analytics?.fb_pixel_id && (
          <Script id="fb-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
              n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
              document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${analytics.fb_pixel_id}'); fbq('track', 'PageView');`}
          </Script>
        )}
      </body>
    </html>
  );
}
