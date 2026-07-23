"use client";

import Link from "next/link";
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
}: {
  locale: Locale;
  d: Pick<Dict,
    "nav_home" | "nav_doctors" | "nav_specialties" | "nav_hospitals" | "nav_districts" | "nav_areas" |
    "nav_blog" | "nav_contact" | "book_appointment" | "call_for_help" | "doctor_add_profile" | "menu" | "close">;
  helplineDisplay: string;
  helpline: string;
  brandName: string;
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

  const NAV = [
    { label: d.nav_home, href: "/" },
    { label: d.nav_doctors, href: "/doctors" },
    { label: d.nav_specialties, href: "/specialties" },
    { label: d.nav_hospitals, href: "/hospitals" },
    { label: d.nav_districts, href: "/districts" },
    { label: d.nav_areas, href: "/areas" },
    { label: d.nav_blog, href: "/blog" },
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
          <Link href={L("/for-doctors")} className="text-[13px] text-brand-100">
            {d.doctor_add_profile}
          </Link>
        </div>
      </div>

      {/* navbar */}
      <div className="sticky top-0 z-50 border-b border-line bg-white/90 backdrop-blur-[10px]">
        <div className="mx-auto flex max-w-site items-center gap-4 px-5 py-3">
          <Link href={L("/")} className="flex items-center gap-[9px]">
            <Logo />
            <span className="font-heading text-[22px] font-bold text-ink">
              {locale === "bn" ? (
                <>ডক্টর<span className="text-brand-600">বন্ধু</span></>
              ) : (
                <>Doctor<span className="text-brand-600">Bondhu</span></>
              )}
            </span>
            <span className="sr-only">{brandName}</span>
          </Link>
          <div className="flex-1" />
          <nav className="hidden items-center gap-1 min-[1060px]:flex">
            {NAV.map((item) => (
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
            ))}
          </nav>
          <LangSwitcher locale={locale} />
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
          <span className="font-heading text-xl font-bold">
            {locale === "bn" ? (
              <>ডক্টর<span className="text-brand-600">বন্ধু</span></>
            ) : (
              <>Doctor<span className="text-brand-600">Bondhu</span></>
            )}
          </span>
          <button
            onClick={() => setOpen(false)}
            className="h-[38px] w-[38px] rounded-[9px] border border-line bg-white text-lg text-ink-mute"
            aria-label={d.close}
          >
            ✕
          </button>
        </div>
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
