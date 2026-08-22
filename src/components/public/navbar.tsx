"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Logo } from "@/components/icons";
import { LangSwitcher } from "./lang-switcher";
import { localeHref, splitLocalePath, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";
import { cn } from "@/lib/utils";

export function Navbar({
  locale,
  d,
  helplineDisplay,
  helpline,
  brandName,
  logoDesktopUrl,
  logoMobileUrl,
  tools,
  showLangSwitcher = true,
}: {
  locale: Locale;
  d: Pick<Dict,
    "nav_home" | "nav_doctors" | "nav_specialties" | "nav_hospitals" | "nav_districts" | "nav_areas" |
    "nav_tools" | "nav_contact" | "book_appointment" | "call_for_help" | "doctor_add_profile" | "menu" | "close">;
  /**
   * The health calculators, already localized and filtered to the ones the
   * admin has switched on. Drives the desktop dropdown under "Tools".
   *
   * Passed in rather than read here because this is a client component and the
   * enabled set lives in site settings — the layout resolves it once on the
   * server and hands down the finished list.
   */
  tools: { slug: string; label: string }[];
  helplineDisplay: string;
  helpline: string;
  brandName: string;
  logoDesktopUrl: string;
  logoMobileUrl: string;
  /**
   * Off for pages that exist in one language only. The switcher rewrites the
   * CURRENT path with an /en prefix, and the doctor intake form has no /en twin
   * to land on, so leaving it on would offer the visitor a 404.
   */
  showLangSwitcher?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [, cleanPath] = splitLocalePath(pathname);

  useEffect(() => {
    const savedScrollY = sessionStorage.getItem("scrollPosition");
    if (savedScrollY) {
      const scrollY = parseInt(savedScrollY, 10);
      if (!isNaN(scrollY)) {
        // A 50ms timeout ensures Next.js has finished its own scroll action
        setTimeout(() => {
          window.scrollTo(0, scrollY);
        }, 50);
      }
      sessionStorage.removeItem("scrollPosition");
    }
  }, [pathname]);

  // The blog is no longer a primary nav entry; it lives in the footer's quick
  // links now. A directory's primary nav should carry what people came to find
  // (doctors, specialties, places) plus the tools that bring them back, and the
  // blog was taking a slot from something that converts.
  //
  // `children` is the desktop-only dropdown. It is a SHORTCUT, never the only
  // path: the parent is a real link to /tools, which lists every tool with a
  // search box, so nothing becomes unreachable if the dropdown never opens.
  const NAV: { label: string; href: string; children?: { label: string; href: string }[] }[] = [
    { label: d.nav_home, href: "/" },
    { label: d.nav_doctors, href: "/doctors" },
    { label: d.nav_specialties, href: "/specialties" },
    { label: d.nav_hospitals, href: "/hospitals" },
    { label: d.nav_districts, href: "/districts" },
    { label: d.nav_areas, href: "/areas" },
    ...(tools.length > 0
      ? [
          {
            label: d.nav_tools,
            href: "/tools",
            children: tools.map((t) => ({ label: t.label, href: `/tools/${t.slug}` })),
          },
        ]
      : []),
    { label: d.nav_contact, href: "/contact" },
  ];

  const isActive = (href: string) =>
    href === "/" ? cleanPath === "/" : cleanPath.startsWith(href);
  const L = (path: string) => localeHref(locale, path);

  return (
    <>
      {/* top utility bar */}
      <div className="hidden bg-brand-700 text-[13px] text-brand-100 sm:block">
        <div className="mx-auto flex w-full max-w-site items-center justify-between px-5 py-[7px]">
          <a href={`tel:${helpline}`} className="flex items-center gap-[7px] text-brand-100">
            <span>✆</span> {d.call_for_help}: {helplineDisplay}
          </a>
          {/* /for-doctors was folded into /contact — one page, one form. */}
          <Link href={L("/contact")} className="text-[13px] text-brand-100">
            {d.doctor_add_profile}
          </Link>
        </div>
      </div>

      {/* navbar */}
      {/* data-sticky-nav: the geo strip measures this bar so it can pin
          directly underneath it instead of sliding behind it. */}
      <div data-sticky-nav className="sticky top-0 z-50 border-b border-line bg-white/90 backdrop-blur-[10px]">
        <div className="mx-auto flex max-w-site items-center gap-4 px-5 py-3">
          <Link href={L("/")} className="flex items-center gap-[9px]" aria-label={brandName}>
            {/* Logo pipeline:
                - Desktop upload (>=640px viewport) shown when set.
                - Mobile upload (<640px) shown when set — lets admins upload a
                  square mark for narrow viewports.
                - Neither uploaded → fall back to the SVG mark + brand text.
                The two <Image>s are wrapped in responsive-visibility classes
                so only one paints per breakpoint (no CLS from swap). */}
            {logoDesktopUrl ? (
              <Image
                src={logoDesktopUrl}
                alt={brandName}
                width={280}
                height={64}
                priority
                sizes="(max-width: 640px) 0px, 280px"
                className="hidden h-16 w-auto object-contain sm:block"
              />
            ) : null}
            {logoMobileUrl ? (
              <Image
                src={logoMobileUrl}
                alt={brandName}
                width={180}
                height={44}
                priority
                sizes="(min-width: 641px) 0px, 180px"
                className="h-11 w-auto object-contain sm:hidden"
              />
            ) : null}
            {!logoDesktopUrl && !logoMobileUrl && (
              <>
                <Logo />
                <span className="font-heading text-[22px] font-bold text-ink">{brandName}</span>
              </>
            )}
            <span className="sr-only">{brandName}</span>
          </Link>
          <div className="flex-1" />
          <nav className="hidden items-center gap-1 min-[1060px]:flex">
            {NAV.map((item) =>
              item.children && item.children.length > 0 ? (
                // Disclosure driven purely by CSS (`group-hover` plus
                // `group-focus-within`) rather than React state: no state means
                // no extra hydration and no flash on first paint, and
                // focus-within is what keeps it reachable by keyboard — tabbing
                // to the parent link reveals the panel and the items follow in
                // natural tab order.
                <div key={item.href} className="group relative">
                  <Link
                    href={L(item.href)}
                    prefetch
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-[11px] py-2 text-[14.5px] transition-colors hover:bg-brand-50 hover:text-brand-700 group-focus-within:bg-brand-50",
                      isActive(item.href) ? "font-bold text-brand-700" : "font-medium text-ink-soft"
                    )}
                  >
                    {item.label}
                    <span
                      aria-hidden
                      className="text-[9px] leading-none transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180"
                    >
                      &#9660;
                    </span>
                  </Link>
                  {/* The pt-2 is a hover bridge between trigger and panel.
                      Without it the pointer crosses a dead gap on the way down
                      and the menu closes underneath it. */}
                  <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    <div className="min-w-[248px] rounded-xl border border-line bg-white p-1.5 shadow-pop">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={L(child.href)}
                          prefetch={false}
                          className={cn(
                            "block rounded-lg px-3 py-2.5 text-[14px] transition-colors hover:bg-brand-50 hover:text-brand-700",
                            cleanPath === child.href ? "font-bold text-brand-700" : "font-medium text-ink-soft"
                          )}
                        >
                          {child.label}
                        </Link>
                      ))}
                      {/* No "see all" row at the bottom of the panel: the
                          parent item is itself a link to the hub, so clicking
                          "Tools" already goes there. A second link to the same
                          URL inside the panel it opened was just a duplicate. */}
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={L(item.href)}
                  prefetch
                  className={cn(
                    "rounded-lg px-[11px] py-2 text-[14.5px] transition-colors hover:bg-brand-50 hover:text-brand-700",
                    isActive(item.href) ? "font-bold text-brand-700" : "font-medium text-ink-soft"
                  )}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>
          {showLangSwitcher && <LangSwitcher locale={locale} />}
          <Link
            href={L("/doctors")}
            className="hidden rounded-[10px] bg-accent px-[18px] py-2.5 text-[14.5px] font-bold text-white shadow-[0_4px_12px_rgba(34,197,94,0.3)] transition-colors hover:bg-accent-hover min-[1060px]:inline-block"
          >
            {d.book_appointment}
          </Link>
          {/* Hamburger for the secondary drawer (specialties, contact, etc.).
              No background or border in mobile — the top bar stays airy and
              the bottom tab bar carries the primary nav weight. */}
          <button
            onClick={() => setOpen(true)}
            aria-label={d.menu}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] text-ink transition-colors hover:bg-brand-50 active:bg-brand-100 min-[1060px]:hidden"
          >
            <span className="flex flex-col gap-[5px]">
              <span className="h-0.5 w-5 rounded-full bg-current" />
              <span className="h-0.5 w-5 rounded-full bg-current" />
              <span className="h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>
        </div>
      </div>

      {/* mobile drawer */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-[60] bg-ink/45 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <div
        className={cn(
          "fixed bottom-0 right-0 top-0 z-[61] flex w-[82%] max-w-[320px] flex-col bg-white p-[18px] shadow-[-8px_0_30px_rgba(15,23,42,0.15)] transition-transform duration-300 ease-[cubic-bezier(.4,0,.2,1)]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="mb-3.5 flex items-center justify-between">
          <span className="font-heading text-xl font-bold text-ink">{brandName}</span>
          <button
            onClick={() => setOpen(false)}
            className="h-[38px] w-[38px] rounded-[9px] border border-line bg-white text-lg text-ink-mute"
            aria-label={d.close}
          >
            ✕
          </button>
        </div>
        {/* Flat list on purpose: no nested submenu on narrow screens. A drawer
            that expands in place makes the visitor manage two levels of
            navigation with one thumb, when tapping "Tools" already lands them
            on a page that lists every tool with a search box. */}
        <div className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={L(item.href)}
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-[10px] px-3.5 py-3 text-base font-semibold",
                locale === "bn" ? "text-right" : "text-left",
                isActive(item.href) ? "bg-brand-50 text-brand-700" : "text-ink-soft"
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <Link
          href={L("/doctors")}
          onClick={() => setOpen(false)}
          className="mt-3.5 rounded-[11px] bg-accent p-[13px] text-center text-base font-bold text-white"
        >
          {d.book_appointment}
        </Link>
        <a
          href={`tel:${helpline}`}
          className="mt-auto block rounded-[11px] border border-warm-border bg-warm-soft p-[13px] text-center text-[15px] font-bold text-warm"
        >
          ✆ {helplineDisplay}
        </a>
      </div>
    </>
  );
}
