import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/seo-utils";
import { t, isLocale, htmlLang, type Locale } from "@/lib/i18n";
import { getEnabledConfig } from "@/lib/integrations";
import { fontVariables } from "@/lib/fonts";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "../globals.css";

// ---------------------------------------------------------------------------
// ROOT LAYOUT for every public URL.
// ---------------------------------------------------------------------------
// This is a *root* layout (it renders <html>/<body>) even though it sits under
// a dynamic segment. `src/app/(dashboard)/layout.tsx` is the second root layout
// and covers /admin + /admin-login.
//
// Why the split: the previous single root layout at src/app/layout.tsx read
// `headers()` to discover the locale. A Dynamic API in the root layout opts the
// ENTIRE app out of static rendering — a production build emitted 0 prerendered
// pages and every request billed Vercel Active CPU. The locale was always
// available as a route param (the middleware rewrites `/doctors` to
// `/bn/doctors`), so the header read was redundant with information we already
// had. Reading it from `params` keeps <html lang> correct AND lets every page
// below become static/ISR.
//
// Do not reintroduce cookies()/headers() anywhere in this file or in any layout
// below it. Per-visitor state belongs in <LocationProvider> on the client.

// The site ships exactly two locales, and `[locale]` is the only dynamic
// segment above every public page. Without this, Next cannot prove the segment
// is enumerable and every route below stays `ƒ Dynamic` no matter how many
// `revalidate` exports the pages carry — the whole tree hinges on these two
// values being known at build time.
export function generateStaticParams() {
  return [{ locale: "bn" }, { locale: "en" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "bn";
  const settings = await getSettings();
  const gscToken = process.env.GOOGLE_SITE_VERIFICATION;
  return {
    metadataBase: new URL(siteUrl()),
    title: t(settings.seo_default_title, locale),
    description: t(settings.seo_default_description, locale),
    // Favicon: point at our OWN /favicon.ico route, never the raw R2 URL.
    // That route (src/app/favicon.ico/route.ts) proxies the admin-uploaded
    // image, so the icon stays admin-configurable while Google sees a stable
    // first-party URL at the exact path it probes first.
    //
    // When nothing is uploaded we omit `icons` entirely so Next.js falls back
    // to the file-based /icon.svg convention, exactly as before.
    ...(settings.favicon_url
      ? { icons: { icon: "/favicon.ico", shortcut: "/favicon.ico", apple: "/favicon.ico" } }
      : {}),
    // GSC verification tag: paste the meta token as GOOGLE_SITE_VERIFICATION env
    // once and Next inlines it into the head of every page. Omit until the
    // token is available so we don't emit an empty content attribute.
    ...(gscToken ? { verification: { google: gscToken } } : {}),
  };
}

export default async function LocaleRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Locale comes from the URL segment the middleware rewrote to — no headers().
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "bn";

  const analytics = await getEnabledConfig("analytics").catch(() => null);

  // Host that serves doctor/hospital/blog images. Preconnecting saves ~360ms
  // on the LCP image handshake (measured with Lighthouse). Value comes from
  // the same env var that next.config.ts uses for the images allowlist.
  const r2Host = process.env.R2_PUBLIC_URL
    ? new URL(process.env.R2_PUBLIC_URL).origin
    : null;

  return (
    <html lang={htmlLang(locale)} className={fontVariables}>
      <body suppressHydrationWarning={true}>
        {/* Guard against the React #11538 crash when the user's browser runs
            Google Translate (or a similar translator) on the page: those
            extensions swap out text nodes, so when React later tries to
            removeChild/insertBefore against its cached node it explodes with
            "NotFoundError". No-op instead of throwing when the parent no
            longer matches — same patch React's own docs recommend. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(typeof Node!=='function'||!Node.prototype)return;var r=Node.prototype.removeChild;Node.prototype.removeChild=function(c){if(c&&c.parentNode!==this){if(c.parentNode){try{return c.parentNode.removeChild(c);}catch(e){return c;}}return c;}return r.apply(this,arguments);};var i=Node.prototype.insertBefore;Node.prototype.insertBefore=function(n,ref){if(ref&&ref.parentNode!==this){return this.appendChild(n);}return i.apply(this,arguments);};})();`,
          }}
        />
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
