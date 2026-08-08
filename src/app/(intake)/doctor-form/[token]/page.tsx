import { sql } from "drizzle-orm";
import Image from "next/image";
import { db } from "@/db";
import { getSettings } from "@/lib/settings";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";
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
  const brandName = settings.site_name?.bn || settings.site_name?.en || "ডক্টরস ফাইন্ড বাংলাদেশ";
  const brandNameEn = settings.site_name?.en || "Doctors Find Bangladesh";
  const helpline = settings.helpline_bn?.trim() || settings.helpline?.trim() || "";
  const helplineDial = settings.helpline?.trim() || "";
  const logo = settings.logo_desktop_url?.trim() || settings.logo_url?.trim() || "";

  const header = (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
        {logo ? (
          <Image src={logo} alt={brandNameEn} width={150} height={40} className="h-9 w-auto object-contain" />
        ) : (
          <span className="font-heading text-[17px] font-bold text-ink">{brandName}</span>
        )}
        {helpline && (
          <a
            href={helplineDial ? `tel:${helplineDial}` : undefined}
            className="ml-auto rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold text-brand-700"
          >
            ☎ {helpline}
          </a>
        )}
      </div>
    </header>
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
        brandName={brandName}
        helpline={helpline}
        helplineDial={helplineDial}
        recaptchaSiteKey={recaptchaSiteKey}
      />
    </div>
  );
}
