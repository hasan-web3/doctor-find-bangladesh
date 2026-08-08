import Link from "next/link";
import Image from "next/image";
import { Logo, Icon } from "@/components/icons";
import { getSettings } from "@/lib/settings";
import { getDict } from "@/lib/dict";
import { t, localeHref, num, type Locale } from "@/lib/i18n";
import { getSpecialties, getNearbyAreas } from "@/lib/data";
import { withPossessive } from "@/lib/bn";

export async function Footer({ locale }: { locale: Locale }) {
  // The footer is rendered into EVERY cached page, so nothing here may depend
  // on per-visitor state (that is what kept these pages out of the CDN) and
  // nothing here may read a cache tagged "doctors".
  //
  // That second rule is subtle and matters more than it looks: a page's full
  // route cache records every tag it read, so a single `revalidateTag("doctors")`
  // from one admin edit would invalidate every page on the site through this
  // component. It used to call resolveDisplayDistrict(), which resolves the
  // district by running the doctor ranking query — one doctor edit then purged
  // the entire cache, exactly the blanket-invalidation problem we removed from
  // revalidate.ts.
  //
  // The district name now comes from the dictionary (it was already the
  // fallback), and getNearbyAreas(null, ...) returns the six busiest thanas
  // site-wide — a stable, crawler-friendly link set that is the same for
  // everybody, rather than one that reshuffles with the visitor's exit node.
  const [settings, specialties] = await Promise.all([
    getSettings(),
    getSpecialties(locale),
  ]);
  const d = getDict(locale);

  // Passing a null district takes getNearbyAreas' site-wide branch: the six
  // thanas with the most doctors, ordered by doctor count. It is a direct query
  // rather than a tagged cache read, so it carries no tag into this page's
  // cache entry.
  const nearbyAreas = await getNearbyAreas(locale, null, null, null);
  const L = (path: string) => localeHref(locale, path);
  const brand = t(settings.brand_name, locale);

  const districtName = locale === "bn" ? d.default_district_bn : d.default_district_en;

  const dynamicTagline =
    locale === "bn"
      ? `${withPossessive(districtName)} বিশ্বস্ত ডাক্তার ডিরেক্টরি। এলাকা ও বিশেষজ্ঞ বিভাগ অনুযায়ী যাচাইকৃত ডাক্তার খুঁজুন ও সহজে অ্যাপয়েন্টমেন্ট নিন।`
      : `${districtName}'s trusted doctor directory. Find verified doctors by area and specialty and easily book appointments.`;

  const QUICK_LINKS = [
    { label: d.nav_about, href: "/about" },
    { label: d.nav_contact, href: "/contact" },
    { label: d.nav_blog, href: "/blog" },
    { label: d.terms, href: "/terms" },
    { label: d.privacy, href: "/privacy" },
    // No "ডাক্তারদের জন্য" row here. It used to point at /for-doctors, which is
    // now folded into /contact — so it would have been a second link to the
    // same URL as "যোগাযোগ" two rows up: a duplicate React key AND two
    // identical links side by side. The doctor pitch keeps its own footer
    // column further right, with a CTA button to the same page.
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
            {(() => {
              // Footer-specific uploads take priority; fall back to header
              // logos, then to the SVG + brand-name text block.
              const desktopFooter = settings.logo_desktop_footer_url || settings.logo_desktop_url;
              const mobileFooter = settings.logo_mobile_footer_url || settings.logo_mobile_url;
              if (!desktopFooter && !mobileFooter) {
                return (
                  <>
                    <Logo light />
                    <span className="font-heading text-[21px] font-bold text-white">{brand}</span>
                  </>
                );
              }
              return (
                <>
                  {desktopFooter ? (
                    <Image
                      src={desktopFooter}
                      alt={brand}
                      width={280}
                      height={64}
                      sizes="(max-width: 640px) 0px, 280px"
                      className="hidden h-16 w-auto object-contain sm:block"
                    />
                  ) : null}
                  {mobileFooter ? (
                    <Image
                      src={mobileFooter}
                      alt={brand}
                      width={180}
                      height={44}
                      sizes="(min-width: 641px) 0px, 180px"
                      className="h-11 w-auto object-contain sm:hidden"
                    />
                  ) : (
                    <span className="font-heading text-[21px] font-bold text-white sm:hidden">{brand}</span>
                  )}
                </>
              );
            })()}
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
            {[...specialties]
              // Specialties that actually have doctors listed first — no point
              // pointing the footer at empty landing pages.
              .sort((a, b) => Number(b.doctor_count > 0) - Number(a.doctor_count > 0))
              .slice(0, 6)
              .map((s) => (
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
                {/* Bengali needs the possessive inflected onto the name — a
                    glued "র" produced "খুলনা সদরর" for consonant endings. */}
                {locale === "bn" ? withPossessive(a.name) : a.name}
                {d.footer_area_doctors_suffix}
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
            href={L("/contact")}
            className="inline-block rounded-[10px] bg-brand-600 px-[18px] py-[11px] text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {d.footer_contact_cta}
          </Link>
        </div>
      </div>
      <div className="mt-11 border-t border-white/10">
        <div className="mx-auto max-w-site px-5 py-5 text-center text-[13.5px] text-ink-faint">
          {/* String, not number: num() groups thousands for numeric input, which
              printed the year as "২,০২৬". */}
          © {num(String(new Date().getFullYear()), locale)} {brand}. {d.footer_rights}
        </div>
      </div>
    </footer>
  );
}
