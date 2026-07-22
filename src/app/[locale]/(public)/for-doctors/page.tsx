import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { LeadForm } from "@/components/public/lead-form";
import { getDict } from "@/lib/dict";
import { t, isLocale, num, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: "/for-doctors",
    title: locale === "bn" ? "ডাক্তারদের জন্য: প্রোফাইল যুক্ত করুন" : "For Doctors: List Your Profile",
    description:
      locale === "bn"
        ? "ডক্টরবন্ধুতে আপনার প্রোফাইল যুক্ত করুন এবং খুলনার হাজারো রোগীর কাছে পৌঁছান। প্রমোশন প্ল্যান ও সুবিধা দেখুন।"
        : "List your profile on DoctorBondhu and reach thousands of patients in Khulna. See promotion plans and benefits.",
    ogTitle: locale === "bn" ? "ডাক্তারদের জন্য" : "For Doctors",
  });
}

export default async function ForDoctorsPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const settings = await getSettings();
  const helplineDisplay = locale === "bn" ? settings.helpline_bn : settings.helpline;

  return (
    <div>
      {/* hero */}
      <div className="text-white [background:linear-gradient(120deg,#0F172A,#134E4A)]">
        <div className="mx-auto max-w-[900px] px-5 py-14 text-center">
          <div className="mb-[18px] inline-block rounded-full bg-brand-300/15 px-3.5 py-1.5 text-[13px] font-semibold text-brand-300">
            {d.fordoc_badge}
          </div>
          <h1 className="mb-3.5 font-heading text-[clamp(28px,4.5vw,38px)] font-bold">{d.fordoc_hero_title}</h1>
          <p className="mx-auto mb-[26px] max-w-[620px] text-[17px] text-[#CBD5E1]">{d.fordoc_sub}</p>
          <a
            href={`tel:${settings.helpline}`}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-base font-bold text-white"
          >
            ✆ {d.fordoc_call_cta} {helplineDisplay}
          </a>
        </div>
      </div>

      {/* plans — hidden entirely when admin has toggled `show_plans` off in
          site settings. In that mode the page falls through to just the hero
          + lead form so doctors can still reach out, but pricing isn't shown. */}
      {settings.show_plans && settings.plans.length > 0 && (
        <div className="mx-auto max-w-site px-5 py-14">
          <div className="mb-9 text-center">
            <h2 className="mb-2 mt-0 font-heading text-[clamp(24px,3.5vw,30px)] font-bold text-ink">{d.plans_title}</h2>
            <p className="m-0 text-[15.5px] text-ink-mute">{d.plans_sub}</p>
          </div>
          <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-3">
            {settings.plans.map((p) => (
              <div
                key={p.key}
                className={cn(
                  "relative rounded-[20px] border-2 bg-white px-6 py-7",
                  p.popular ? "border-brand-600 shadow-[0_16px_40px_rgba(13,148,136,.18)]" : "border-line shadow-card"
                )}
              >
                {p.popular && (
                  <span className="absolute -top-[13px] left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3.5 py-[5px] text-xs font-bold text-white">
                    {d.plan_popular}
                  </span>
                )}
                <div className="mb-1.5 font-heading text-xl font-bold text-ink">{t(p.name, locale)}</div>
                <div className="mb-5 flex items-baseline gap-1">
                  <span className="font-heading text-[34px] font-extrabold text-brand-600">৳ {num(p.price, locale)}</span>
                  <span className="text-sm text-ink-ghost">{t(p.period, locale)}</span>
                </div>
                <div className="mb-6 flex flex-col gap-[11px]">
                  {p.feats.map((f, i) => (
                    <div key={i} className="flex items-start gap-[9px] text-[14.5px] text-ink-mute">
                      <span className="shrink-0 font-bold text-accent">✓</span>
                      {t(f, locale)}
                    </div>
                  ))}
                </div>
                <a
                  href="#doctor-lead-form"
                  className={cn(
                    "block w-full rounded-[11px] p-[13px] text-center text-[15px] font-bold text-white",
                    p.popular ? "bg-accent hover:bg-accent-hover" : "bg-brand-600 hover:bg-brand-700"
                  )}
                >
                  {d.plan_cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* lead form */}
      <div id="doctor-lead-form" className="mx-auto max-w-[640px] px-5 pb-16">
        <div className="rounded-[20px] border border-line bg-white p-7">
          <h3 className="mb-[18px] mt-0 text-center font-heading text-xl font-bold text-ink">{d.fordoc_form_title}</h3>
          <LeadForm
            type="doctor"
            d={d}
            namePlaceholder={d.fordoc_name_placeholder}
            messagePlaceholder={d.fordoc_message_placeholder}
            submitLabel={d.fordoc_submit}
            extraField={{ name: "extra", placeholder: d.fordoc_specialty_placeholder }}
          />
        </div>
      </div>
    </div>
  );
}
