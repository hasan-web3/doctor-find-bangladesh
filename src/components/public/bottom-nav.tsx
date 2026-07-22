"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { localeHref, splitLocalePath, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";
import { cn } from "@/lib/utils";

// Facebook-style bottom tab bar for mobile. Sits fixed at the viewport bottom
// so the site feels like an app; hidden on ≥1060px where the top nav has room
// to show everything. The label list mirrors the top navbar's core entries
// (Home, Doctors, Hospitals, Areas, Blog) — the tabs users hit most.
export function BottomNav({
  locale,
  d,
}: {
  locale: Locale;
  d: Pick<Dict, "nav_home" | "nav_doctors" | "nav_hospitals" | "nav_areas" | "nav_blog">;
}) {
  const pathname = usePathname();
  const [, cleanPath] = splitLocalePath(pathname);
  const L = (path: string) => localeHref(locale, path);

  const TABS: { label: string; href: string; icon: string }[] = [
    { label: d.nav_home, href: "/", icon: "home" },
    { label: d.nav_doctors, href: "/doctors", icon: "user" },
    { label: d.nav_hospitals, href: "/hospitals", icon: "building" },
    { label: d.nav_areas, href: "/areas", icon: "pin" },
    { label: d.nav_blog, href: "/blog", icon: "book" },
  ];

  const isActive = (href: string) =>
    href === "/" ? cleanPath === "/" : cleanPath.startsWith(href);

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-[10px]",
        // paint safely above iOS home indicator; matches Facebook's tab bar
        "pb-[env(safe-area-inset-bottom)]",
        // top nav takes over on wide screens
        "min-[1060px]:hidden"
      )}
    >
      <ul className="mx-auto flex max-w-site items-stretch justify-around px-1.5">
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={L(t.href)}
                prefetch
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
                title={t.label}
                className={cn(
                  // Icon-only tap target sits at 56px so it comfortably clears
                  // WCAG 2.5.5. The label survives as aria-label/title for
                  // screen readers and tooltips even though it isn't drawn.
                  "group flex h-14 items-center justify-center rounded-xl transition-all duration-150",
                  "active:scale-[0.94]",
                  active ? "text-brand-700" : "text-ink-faint hover:text-brand-600"
                )}
              >
                {/* Icon pill — the Facebook-app cue for the current tab. */}
                <span
                  className={cn(
                    "flex h-10 w-14 items-center justify-center rounded-full transition-colors",
                    active ? "bg-brand-50" : "group-hover:bg-brand-50/70"
                  )}
                >
                  <Icon name={t.icon} size={24} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
