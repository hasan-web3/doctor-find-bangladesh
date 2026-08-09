import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { getDict } from "@/lib/dict";
import { t, isLocale, localeHref, num, type Locale } from "@/lib/i18n";

// ISR: static copy; edits push via revalidatePath.
export const revalidate = 86400;

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
        ? "আমরা কারা, ডাক্তারদের তথ্য কোথা থেকে আসে, কীভাবে যাচাই করা হয় এবং কত ঘন ঘন হালনাগাদ হয় জানুন।"
        : "Who we are, where our doctor information comes from, how it is verified and how often it is updated.",
  });
}

export default async function AboutPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);
  const settings = await getSettings();
  const brand = t(settings.brand_name, locale);
  const address = t(settings.address, locale);
  const helplineDisplay = locale === "bn" ? settings.helpline_bn : settings.helpline;
  const L = (path: string) => localeHref(locale, path);

  const VALUES = [
    { title: d.value1_title, text: d.value1_text, icon: "shield", bg: "#F0FDFA", fg: "#0D9488" },
    { title: d.value2_title, text: d.value2_text, icon: "pin", bg: "#FFF7ED", fg: "#EA580C" },
    { title: d.value3_title, text: d.value3_text, icon: "heart", bg: "#ECFDF5", fg: "#059669" },
  ];

  // Health information is a YMYL topic: Google (and a reader deciding whether
  // to trust a chamber address) wants to know who publishes this, where the
  // data comes from, how it is checked and what to do when it is wrong. The
  // page used to answer none of those, so these four blocks are the substance
  // of it and the value cards are now the decoration.
  const VERIFY_STEPS = [d.about_verify_1, d.about_verify_2, d.about_verify_3, d.about_verify_4];

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

      {/* ---- how the directory works ---- */}
      <div className="mx-auto max-w-[900px] px-5 pb-4 pt-14">
        <section className="rounded-2xl border border-line bg-white p-6 sm:p-8">
          <h2 className="mb-3 mt-0 font-heading text-[clamp(21px,3vw,26px)] font-bold text-ink">
            {d.about_how_title}
          </h2>
          <p className="m-0 text-[15.5px] leading-[1.9] text-ink-mute">{d.about_how_text}</p>
        </section>
      </div>

      {/* ---- verification method ---- */}
      <div className="mx-auto max-w-[900px] px-5 pb-4">
        <section className="rounded-2xl border border-line bg-white p-6 sm:p-8">
          <h2 className="mb-3 mt-0 font-heading text-[clamp(21px,3vw,26px)] font-bold text-ink">
            {d.about_verify_title}
          </h2>
          <p className="mb-5 mt-0 text-[15.5px] leading-[1.9] text-ink-mute">{d.about_verify_intro}</p>
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {VERIFY_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3.5">
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 font-heading text-[13px] font-bold text-brand-700"
                >
                  {num(i + 1, locale)}
                </span>
                <span className="text-[15px] leading-[1.85] text-ink-mute">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mb-0 mt-6 rounded-[14px] bg-page px-5 py-4 text-[14.5px] leading-relaxed text-ink-mute">
            <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-text align-middle">
              {d.verified_badge}
            </span>
            {d.about_verified_badge_note}
          </p>
        </section>
      </div>

      {/* ---- editorial / update policy ---- */}
      <div className="mx-auto max-w-[900px] px-5 pb-4">
        <section className="rounded-2xl border border-line bg-white p-6 sm:p-8">
          <h2 className="mb-3 mt-0 font-heading text-[clamp(21px,3vw,26px)] font-bold text-ink">
            {d.about_editorial_title}
          </h2>
          <p className="m-0 text-[15.5px] leading-[1.9] text-ink-mute">{d.about_editorial_text}</p>
        </section>
      </div>

      {/* ---- medical disclaimer ---- */}
      <div className="mx-auto max-w-[900px] px-5 pb-4">
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 sm:p-8">
          <h2 className="mb-3 mt-0 font-heading text-[clamp(21px,3vw,26px)] font-bold text-ink">
            {d.about_disclaimer_title}
          </h2>
          <p className="m-0 text-[15.5px] leading-[1.9] text-ink-mute">{d.about_disclaimer_text}</p>
        </section>
      </div>

      {/* ---- publisher identity + NAP, matching the Organization JSON-LD ---- */}
      <div className="mx-auto max-w-[900px] px-5 pb-4">
        <section className="rounded-2xl border border-line bg-white p-6 sm:p-8">
          <h2 className="mb-3 mt-0 font-heading text-[clamp(21px,3vw,26px)] font-bold text-ink">
            {d.about_publisher_title}
          </h2>
          <p className="mb-4 mt-0 text-[15.5px] leading-[1.9] text-ink-mute">{d.about_publisher_text}</p>
          <div className="mb-1 font-heading text-lg font-bold text-ink">{brand}</div>
          <div className="flex flex-col gap-2.5 text-[15px]">
            {address && (
              <div className="flex items-start gap-2.5 text-ink-mute">
                <Icon name="pin" size={17} className="mt-[3px] shrink-0 text-brand-600" />
                <span>{address}</span>
              </div>
            )}
            {settings.helpline && (
              <a href={`tel:${settings.helpline}`} className="flex items-center gap-2.5 font-semibold text-brand-700 hover:underline">
                <Icon name="phone" size={17} className="shrink-0 text-brand-600" />
                <span>{helplineDisplay}</span>
              </a>
            )}
            {settings.email && (
              <a href={`mailto:${settings.email}`} className="flex items-center gap-2.5 break-all font-semibold text-brand-700 hover:underline">
                <Icon name="mail" size={17} className="shrink-0 text-brand-600" />
                <span>{settings.email}</span>
              </a>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 text-sm font-semibold text-brand-600">
            <Link href={L("/contact")} className="hover:underline">{d.nav_contact}</Link>
            <Link href={L("/privacy")} className="hover:underline">{d.privacy}</Link>
            <Link href={L("/terms")} className="hover:underline">{d.terms}</Link>
          </div>
        </section>
      </div>

      {/* ---- corrections ---- */}
      <div className="mx-auto max-w-[900px] px-5 pb-4">
        <section className="rounded-2xl border border-line bg-white p-6 sm:p-8">
          <h2 className="mb-3 mt-0 font-heading text-[clamp(21px,3vw,26px)] font-bold text-ink">
            {d.about_correction_title}
          </h2>
          <p className="mb-5 mt-0 text-[15.5px] leading-[1.9] text-ink-mute">{d.about_correction_text}</p>
          <Link
            href={L("/contact")}
            className="inline-block rounded-xl bg-brand-600 px-6 py-3 text-[15px] font-bold text-white transition-colors hover:bg-brand-700"
          >
            {d.about_correction_cta}
          </Link>
        </section>
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
