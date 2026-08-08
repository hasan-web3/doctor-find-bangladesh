import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Navbar } from "@/components/public/navbar";
import { getSettings } from "@/lib/settings";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";
import { getDict } from "@/lib/dict";
import { t } from "@/lib/i18n";
import { brandOgImage } from "@/lib/seo";
import { siteUrl, brandIdentity } from "@/lib/seo-utils";
import { IntakeForm } from "./intake-form";

// This route is the one deliberate exception to the site's ISR-everywhere rule.
// A cached render would serve a stale answer to the only question that matters
// here — "has this token been used yet?" — which is the difference between a
// working form and a dead one. Nothing about it is indexable or shared, so there
// is no cache to lose: one visitor, one URL, one submission.
export const dynamic = "force-dynamic";

type LinkRow = {
  id: number;
  client_name: string;
  submitted_at: string | null;
};

/**
 * The link is shared by hand, over WhatsApp and Messenger, so the preview card
 * IS the first impression: a doctor who is about to type their details into a
 * form should see our brand on the message, not a bare host name.
 *
 * The image is the same brand card the main domain shows (see brandOgImage).
 * The title and description describe the form rather than the doctor, because
 * this metadata is identical for every token — nothing about who the link was
 * made for leaks into a preview that sits in a chat thread.
 *
 * `noindex` still applies: a preview fetcher reads OG tags and ignores robots
 * directives, while a search engine obeys the noindex and drops the URL. Both
 * behaviours are what we want at the same time.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const [{ token }, settings, ogImage] = await Promise.all([params, getSettings(), brandOgImage()]);
  const siteName = brandIdentity(settings.site_name, settings.brand_name).name;
  const title = "ডাক্তারের তথ্য ফর্ম";
  const description =
    "এই ফর্মটি পূরণ করে দিলে আমরা ডাক্তারের প্রোফাইলটি তৈরি করে দেব। ফর্মটি একবারই জমা দেওয়া যাবে।";

  return {
    title,
    description,
    robots: { index: false, follow: false, nocache: true, noarchive: true, nosnippet: true },
    openGraph: {
      type: "website",
      title: `${title} | ${siteName}`,
      description,
      siteName,
      locale: "bn_BD",
      // This exact page. og:url is the address a share treats as canonical, so
      // pointing it at the home page (or at a tokenless /doctor-form, which is
      // a 404) would send the client somewhere other than their own form.
      url: siteUrl(`/doctor-form/${encodeURIComponent(token)}`),
      images: [{ url: ogImage, width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteName}`,
      description,
      images: [ogImage],
    },
  };
}

export default async function DoctorIntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Length guard before the query: every real token is 32 URL-safe characters,
  // so anything else is a probe and doesn't deserve a database round-trip.
  const clean = (token || "").trim();
  const link: LinkRow | null =
    clean.length >= 10 && clean.length <= 128
      ? (
          await db.execute<LinkRow>(sql`
            SELECT id, client_name, submitted_at::text
              FROM doctor_form_links
             WHERE token = ${clean}
             LIMIT 1
          `)
        ).rows[0] ?? null
      : null;

  const [settings, recaptchaSiteKey] = await Promise.all([getSettings(), getRecaptchaSiteKey()]);
  const helpline = settings.helpline_bn?.trim() || settings.helpline?.trim() || "";
  const helplineDial = settings.helpline?.trim() || "";

  // The real site header, not a lookalike. Someone who was emailed a link and is
  // about to type a doctor's details into it should see the same masthead they
  // saw on the website, with working links back to it. Bangla only, and the
  // language switcher is hidden: this page has no /en twin to switch to.
  const dict = getDict("bn");
  const header = (
    <Navbar
      locale="bn"
      d={dict}
      helplineDisplay={helpline}
      helpline={helplineDial}
      brandName={t(settings.brand_name, "bn")}
      logoDesktopUrl={settings.logo_desktop_url}
      logoMobileUrl={settings.logo_mobile_url}
      showLangSwitcher={false}
    />
  );

  // One message for "never existed" and one for "already used" would let anyone
  // probe for valid tokens, so both land here with the same wording.
  if (!link || link.submitted_at) {
    return (
      <div className="min-h-screen bg-page">
        {header}
        <main className="mx-auto max-w-xl px-4 py-14 sm:px-6">
          <div className="rounded-2xl border border-line bg-white p-7 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warm-soft text-2xl text-warm">
              !
            </div>
            <h1 className="mb-2 mt-0 font-heading text-xl font-bold text-ink">
              এই লিংকটি আর কাজ করছে না
            </h1>
            <p className="mb-1 text-[14.5px] leading-relaxed text-ink-mute">
              ফর্মটি একবারই জমা দেওয়া যায়। আপনার ফর্ম জমা পড়ে গেলে বা লিংকটি পুরনো হয়ে গেলে এই পাতা দেখায়।
            </p>
            <p className="mb-5 text-[14.5px] leading-relaxed text-ink-mute">
              নতুন লিংক দরকার হলে আমাদের সাথে যোগাযোগ করুন, আমরা সাথে সাথে পাঠিয়ে দেব।
            </p>
            {helpline && (
              <a
                href={helplineDial ? `tel:${helplineDial}` : undefined}
                className="inline-block rounded-xl bg-brand-600 px-5 py-3 text-[15px] font-bold text-white"
              >
                কল করুন {helpline}
              </a>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      {header}
      <IntakeForm
        token={clean}
        clientName={link.client_name}
        brandName={t(settings.site_name, "bn")}
        helpline={helpline}
        helplineDial={helplineDial}
        recaptchaSiteKey={recaptchaSiteKey}
      />
    </div>
  );
}
