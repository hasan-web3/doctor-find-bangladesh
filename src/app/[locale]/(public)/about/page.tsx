import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { getDict } from "@/lib/dict";
import { t, isLocale, localeHref, num, type Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: "/about",
    title: locale === "bn" ? "আমাদের সম্পর্কে" : "About Us",
    description:
      locale === "bn"
        ? "ডক্টরবন্ধু খুলনার একটি বিশ্বস্ত ডাক্তার ডিরেক্টরি। আমাদের লক্ষ্য ও মূল্যবোধ সম্পর্কে জানুন।"
        : "DoctorBondhu is a trusted doctor directory for Khulna. Learn about our mission and values.",
  });
}

export default async function AboutPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const settings = await getSettings();
  const brand = t(settings.brand_name, locale);

  const VALUES = [
    { title: d.value1_title, text: d.value1_text, icon: "shield", bg: "#F0FDFA", fg: "#0D9488" },
    { title: d.value2_title, text: d.value2_text, icon: "pin", bg: "#FFF7ED", fg: "#EA580C" },
    { title: d.value3_title, text: d.value3_text, icon: "heart", bg: "#ECFDF5", fg: "#059669" },
  ];

  return (
    <div>
      <div className="[background:linear-gradient(180deg,#F0FDFA,#F8FAFC)]">
        <div className="mx-auto max-w-[820px] px-5 py-[52px] text-center">
          <h1 className="mb-3.5 font-heading text-[clamp(28px,4.5vw,38px)] font-bold text-ink">
            {locale === "bn" ? `${brand} ${d.about_suffix}` : `${d.about_suffix} ${brand}`}
          </h1>
          <p className="m-0 text-[17px] leading-[1.8] text-ink-mute">
            {brand} {d.about_intro_1}
          </p>
        </div>
      </div>

      <div className="bg-brand-700">
        <div className="mx-auto grid max-w-[1000px] grid-cols-2 gap-[18px] px-5 py-9 sm:grid-cols-4">
          {settings.stats.map((s, i) => (
            <div key={i} className="text-center text-white">
              <div className="font-heading text-[clamp(26px,4vw,34px)] font-extrabold">
                {num(s.value, locale)}{s.suffix}
              </div>
              <div className="mt-1 text-sm text-brand-200">{t(s.label, locale)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1000px] px-5 py-14">
        <div className="mb-9 text-center">
          <h2 className="m-0 font-heading text-[clamp(24px,3.5vw,30px)] font-bold text-ink">{d.our_values}</h2>
        </div>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-2xl border border-line bg-white px-[22px] py-[26px]">
              <div className="mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[14px]" style={{ background: v.bg, color: v.fg }}>
                <Icon name={v.icon} />
              </div>
              <div className="mb-[7px] font-heading text-lg font-bold text-ink">{v.title}</div>
              <div className="text-[14.5px] leading-relaxed text-ink-mute">{v.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="[background:linear-gradient(120deg,#0D9488,#0F766E)]">
        <div className="mx-auto max-w-[800px] px-5 py-12 text-center text-white">
          <h2 className="mb-5 font-heading text-[clamp(22px,3.4vw,28px)] font-bold">{d.about_cta}</h2>
          <Link href={localeHref(locale, "/doctors")} className="inline-block rounded-xl bg-white px-7 py-3.5 text-base font-bold text-brand-700">
            {d.find_doctor}
          </Link>
        </div>
      </div>
    </div>
  );
}
