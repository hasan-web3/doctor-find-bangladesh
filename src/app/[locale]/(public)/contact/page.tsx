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

export const dynamic = "force-dynamic";

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
        ? "ডক্টরবন্ধুর সাথে যোগাযোগ করুন। রোগীদের সহায়তা ও ডাক্তারদের প্রোফাইল যুক্ত করার জন্য হেল্পলাইন, হোয়াটসঅ্যাপ ও মেসেজ।"
        : "Contact DoctorBondhu. Helpline, WhatsApp and messaging for patient support and doctor profile listing.",
  });
}

export default async function ContactPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const [settings, maps] = await Promise.all([getSettings(), getEnabledConfig("google_maps")]);
  const address = t(settings.address, locale);

  const paths = [
    { title: d.contact_patient_title, text: d.contact_patient_text, icon: "phone", bg: "#F0FDFA", fg: "#0D9488", cta: d.contact_patient_cta },
    { title: d.contact_doctor_title, text: d.contact_doctor_text, icon: "user", bg: "#FFF7ED", fg: "#EA580C", cta: d.contact_doctor_cta },
  ];

  return (
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
        <div className="rounded-[18px] border border-line bg-white p-[26px]">
          <h3 className="mb-4 mt-0 font-heading text-[19px] font-bold text-ink">{d.contact_form_title}</h3>
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
  );
}
