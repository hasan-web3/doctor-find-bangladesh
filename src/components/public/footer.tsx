import Link from "next/link";
import { Logo, Icon } from "@/components/icons";
import { getSettings } from "@/lib/settings";
import { getDict } from "@/lib/dict";
import { t, localeHref, num, type Locale } from "@/lib/i18n";
import { getSpecialties, getNearbyAreas } from "@/lib/data";
import { detectArea } from "@/lib/geo";
import { withPossessive } from "@/lib/bn";

export async function Footer({ locale }: { locale: Locale }) {
  const [settings, specialties, geo] = await Promise.all([
    getSettings(),
    getSpecialties(locale),
    detectArea(),
  ]);
  const nearbyAreas = await getNearbyAreas(locale, geo.districtId, geo.lat, geo.lng);
  const d = getDict(locale);
  const L = (path: string) => localeHref(locale, path);
  const brand = t(settings.brand_name, locale);

  const districtNameBn = geo.districtName?.bn || d.default_district_bn;
  const districtNameEn = geo.districtName?.en || d.default_district_en;

  const dynamicTagline =
    locale === "bn"
      ? `${withPossessive(districtNameBn)} বিশ্বস্ত ডাক্তার ডিরেক্টরি। এলাকা ও বিশেষজ্ঞ বিভাগ অনুযায়ী যাচাইকৃত ডাক্তার খুঁজুন ও সহজে অ্যাপয়েন্টমেন্ট নিন।`
      : `${districtNameEn}'s trusted doctor directory. Find verified doctors by area and specialty and easily book appointments.`;

  const QUICK_LINKS = [
    { label: d.nav_about, href: "/about" },
    { label: d.nav_contact, href: "/contact" },
    { label: d.nav_blog, href: "/blog" },
    { label: d.terms, href: "/terms" },
    { label: d.privacy, href: "/privacy" },
    { label: d.footer_for_doctors, href: "/for-doctors" },
  ];

  const socials = [
    settings.facebook && { label: "f", href: settings.facebook, name: "Facebook" },
    settings.youtube && { label: "▶", href: settings.youtube, name: "YouTube" },
    settings.instagram && { label: "◎", href: settings.instagram, name: "Instagram" },
  ].filter(Boolean) as { label: string; href: string; name: string }[];

  return (
    <footer className="bg-ink text-ink-ghost">
      <div className="mx-auto grid max-w-site grid-cols-1 gap-[34px] px-5 pt-[52px] sm:grid-cols-2 min-[900px]:grid-cols-[1.6fr_1fr_1fr_1fr_1.2fr]">
        <div>
          <div className="mb-3.5 flex items-center gap-[9px]">
            <Logo light />
            <span className="font-heading text-[21px] font-bold text-white">
              {locale === "bn" ? (
                <>ডক্টর<span className="text-brand-300">বন্ধু</span></>
              ) : (
                <>Doctor<span className="text-brand-300">Bondhu</span></>
              )}
            </span>
          </div>
          <p className="mb-4 max-w-[300px] text-sm leading-relaxed">{dynamicTagline}</p>
          <div className="flex flex-col gap-2">
            {settings.address && (
              <div className="flex items-center gap-[7px] text-[15px] text-brand-300">
                <Icon name="pin" size={16} className="shrink-0" />
                <span className="font-semibold">{t(settings.address, locale)}</span>
              </div>
            )}
            {settings.helpline && (
              <a href={`tel:${settings.helpline}`} className="inline-flex items-center gap-[7px] text-[15px] font-semibold text-brand-300">
                <Icon name="phone" size={16} className="shrink-0" /> {locale === "bn" ? settings.helpline_bn : settings.helpline}
              </a>
            )}
            {settings.email && (
              <a href={`mailto:${settings.email}`} className="inline-flex items-center gap-[7px] text-[15px] font-semibold text-brand-300">
                <Icon name="mail" size={16} className="shrink-0" /> {settings.email}
              </a>
            )}
          </div>

          {socials.length > 0 && (
            <div className="mt-4 flex gap-2.5">
              {socials.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-white/5 text-sm font-bold text-[#CBD5E1]"
                >
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3.5 font-heading text-[15px] font-bold text-white">{d.footer_popular_specs}</div>
          <div className="flex flex-col gap-[9px]">
            {specialties.slice(0, 6).map((s) => (
              <Link key={s.id} href={L(`/specialties/${s.slug}`)} className="text-sm text-ink-ghost transition-colors hover:text-brand-300">
                {s.name}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3.5 font-heading text-[15px] font-bold text-white">{d.footer_by_area}</div>
          <div className="flex flex-col gap-[9px]">
            {nearbyAreas.map((a) => (
              <Link key={a.id} href={L(`/area/doctors/${a.district_slug}/${a.slug}`)} className="text-sm text-ink-ghost transition-colors hover:text-brand-300">
                {a.name}{d.footer_area_doctors_suffix}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3.5 font-heading text-[15px] font-bold text-white">{d.footer_quick_links}</div>
          <div className="flex flex-col gap-[9px]">
            {QUICK_LINKS.map((l) => (
              <Link key={l.href} href={L(l.href)} className="text-sm text-ink-ghost transition-colors hover:text-brand-300">
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3.5 font-heading text-[15px] font-bold text-white">{d.footer_for_doctors}</div>
          <p className="mb-3.5 text-sm leading-relaxed">{d.footer_for_doctors_text}</p>
          <Link
            href={L("/for-doctors")}
            className="inline-block rounded-[10px] bg-brand-600 px-[18px] py-[11px] text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {d.footer_contact_cta}
          </Link>
        </div>
      </div>
      <div className="mt-11 border-t border-white/10">
        <div className="mx-auto max-w-site px-5 py-5 text-center text-[13.5px] text-ink-faint">
          © {num(new Date().getFullYear(), locale)} {brand}. {d.footer_rights}
        </div>
      </div>
    </footer>
  );
}
