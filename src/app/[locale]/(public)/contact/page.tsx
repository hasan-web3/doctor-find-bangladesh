import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { Icon } from "@/components/icons";
import { LeadForm } from "@/components/public/lead-form";
import { getSettings } from "@/lib/settings";
import { getEnabledConfig } from "@/lib/integrations";
import { buildMetadata } from "@/lib/seo";
import { getDict } from "@/lib/dict";
import { t, isLocale, num, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// THE site's single contact page. It absorbed /for-doctors: that page had its
// own lead form and its own hero, which meant two forms writing into the same
// leads table and two inboxes to work through. Its hero (and the promotion
// plans it showed) now live here, so doctors and patients land on one page with
// one form. /for-doctors itself 308s here — see the redirects in next.config.ts.
//
// Every phone number below reads from site settings (admin → সেটিংস), never a
// literal, so changing the helpline in the dashboard changes it everywhere.
//
// ISR: form shell only; the POST is a Server Action.
//
// This page used to be `force-dynamic`, which was the only genuinely wrong
// dynamic directive on the public site: nothing here varies per visitor. The
// form submits through a Server Action, which posts to the server regardless
// of how the surrounding HTML was rendered, so the shell caches safely.
export const revalidate = 86400;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: "/contact",
    title: locale === "bn" ? "যোগাযোগ করুন" : "Contact Us",
    description:
      locale === "bn"
        ? "ডক্টরস ফাইন্ড বাংলাদেশর সাথে যোগাযোগ করুন। রোগীদের সহায়তা ও ডাক্তারদের প্রোফাইল যুক্ত করার জন্য হেল্পলাইন, হোয়াটসঅ্যাপ ও মেসেজ।"
        : "Contact Doctors Find Bangladesh. Helpline, WhatsApp and messaging for patient support and doctor profile listing.",
  });
}

export default async function ContactPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const [settings, maps] = await Promise.all([getSettings(), getEnabledConfig("google_maps")]);
  const address = t(settings.address, locale);
  const helplineDisplay = locale === "bn" ? settings.helpline_bn : settings.helpline;
  const showPlans = settings.show_plans && settings.plans.length > 0;

  const paths = [
    { title: d.contact_patient_title, text: d.contact_patient_text, icon: "phone", bg: "#F0FDFA", fg: "#0D9488", cta: d.contact_patient_cta },
    { title: d.contact_doctor_title, text: d.contact_doctor_text, icon: "user", bg: "#FFF7ED", fg: "#EA580C", cta: d.contact_doctor_cta },
  ];

  return (
    <div>
      {/* hero — moved here verbatim from the retired /for-doctors page. It is
          the doctor-facing pitch, and it sits above the shared form because
          doctors are the audience this page most needs to convert; patients
          reach the same form from the cards right below it.
          The heading is an h2, not an h1: /contact keeps ONE h1 ("যোগাযোগ
          করুন") so the page has a single unambiguous topic for Google. */}
      <div className="text-white [background:linear-gradient(120deg,#0F172A,#134E4A)]">
        <div className="mx-auto max-w-[900px] px-5 py-14 text-center">
          <div className="mb-[18px] inline-block rounded-full bg-brand-300/15 px-3.5 py-1.5 text-[13px] font-semibold text-brand-300">
            {d.fordoc_badge}
          </div>
          <h2 className="mb-3.5 mt-0 font-heading text-[clamp(28px,4.5vw,38px)] font-bold">{d.fordoc_hero_title}</h2>
          <p className="mx-auto mb-[26px] max-w-[620px] text-[17px] text-[#CBD5E1]">{d.fordoc_sub}</p>
          <a
            href={`tel:${settings.helpline}`}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-7 py-3.5 text-base font-bold text-white"
          >
            ✆ {d.fordoc_call_cta} {helplineDisplay}
          </a>
        </div>
      </div>

      {/* promotion plans — same admin `show_plans` toggle as before, just
          rendered here now that /for-doctors is gone. Their CTA scrolls to the
          form below instead of opening a second, doctor-only form. */}
      {showPlans && (
        <div className="mx-auto max-w-site px-5 pt-14">
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
                  href="#contact-form"
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

      <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <Breadcrumbs locale={locale} items={[{ name: d.breadcrumb_home, path: "/" }, { name: d.nav_contact }]} />
      <h1 className="mb-2 font-heading text-[clamp(26px,4vw,34px)] font-bold text-ink">{d.contact_title}</h1>
      <p className="mb-7 text-base text-ink-mute">{d.contact_sub}</p>

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {paths.map((c) => (
          <div key={c.title} className="rounded-[18px] border border-line bg-white p-6">
            <div className="mb-3.5 flex h-[52px] w-[52px] items-center justify-center rounded-[14px]" style={{ background: c.bg, color: c.fg }}>
              <Icon name={c.icon} />
            </div>
            <div className="mb-2 font-heading text-lg font-bold text-ink">{c.title}</div>
            <p className="mb-4 text-[14.5px] leading-relaxed text-ink-mute">{c.text}</p>
            {c.icon === "user" ? (
              <div className="flex flex-col items-start gap-2">
                <a
                  href={`tel:${settings.helpline}`}
                  className="inline-flex items-center gap-[7px] text-[15px] font-bold text-brand-600"
                >
                  ✆ {locale === "bn" ? settings.helpline_bn : settings.helpline}
                </a>
                {settings.email ? (
                  <a
                    href={`mailto:${settings.email}`}
                    className="inline-flex items-center gap-[7px] text-[15px] font-semibold text-ink-mute"
                  >
                    ✉ {settings.email}
                  </a>
                ) : null}
              </div>
            ) : (
              <a
                href={`tel:${settings.helpline}`}
                className="inline-flex items-center gap-[7px] text-[15px] font-bold text-brand-600"
              >
                ✆ {locale === "bn" ? settings.helpline_bn : settings.helpline}
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div id="contact-form" className="scroll-mt-24 rounded-[18px] border border-line bg-white p-[26px]">
          <h3 className="mb-4 mt-0 font-heading text-[19px] font-bold text-ink">{d.contact_form_title}</h3>
          {/* The one form on the site. `type` stays "patient" because that is
              what the lead_type enum defaults to — the dashboard no longer
              splits leads by type, so the value is vestigial and no migration
              was worth running against the live database to drop it. */}
          <LeadForm type="patient" d={d} />
        </div>
        <div>
          <div className="mb-4 rounded-[18px] bg-brand-700 p-6 text-white">
            <div className="mb-3.5 font-heading text-lg font-bold">{d.direct_contact}</div>
            <div className="flex flex-col gap-3 text-[15px]">
              <a href={`tel:${settings.helpline}`} className="flex items-center gap-2.5 text-white">
                <span>✆</span> {locale === "bn" ? settings.helpline_bn : settings.helpline}
              </a>
              <div className="flex items-center gap-2.5">
                <span>◉</span> {address}
              </div>
              <a
                href={`https://wa.me/${settings.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-brand-300"
              >
                {d.whatsapp_message}
              </a>
            </div>
          </div>
          {maps?.api_key ? (
            <div className="overflow-hidden rounded-[18px] border border-line">
              <iframe
                title={d.our_address}
                src={`https://www.google.com/maps/embed/v1/place?key=${maps.api_key}&q=${encodeURIComponent(address)}`}
                className="h-[190px] w-full border-0"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="relative h-[190px] overflow-hidden rounded-[18px] border border-line bg-white">
              <div className="absolute inset-0 [background:repeating-linear-gradient(0deg,transparent,transparent_24px,#F0FDFA_24px,#F0FDFA_25px),repeating-linear-gradient(90deg,transparent,transparent_24px,#F0FDFA_24px,#F0FDFA_25px)]" />
              <div className="absolute left-1/2 top-[45%] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[50%_50%_50%_0] bg-warm shadow-[0_6px_14px_rgba(249,115,22,.4)]" />
              <div className="absolute bottom-3 left-3 rounded-[9px] border border-line bg-white px-[11px] py-[5px] text-[12.5px] font-semibold text-ink-mute">
                {address}
              </div>
            </div>
          )}
          <span className="sr-only">{num(0, locale)}</span>
        </div>
      </div>
      </div>
    </div>
  );
}
