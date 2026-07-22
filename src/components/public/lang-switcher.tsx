"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { splitLocalePath, localeHref, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Tiny inline SVG flags (emoji flags don't render on Windows browsers).
function FlagBD({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 20 14" aria-hidden className="rounded-[2px]">
      <rect width="20" height="14" fill="#006A4E" />
      <circle cx="8.5" cy="7" r="4" fill="#F42A41" />
    </svg>
  );
}

function FlagEN({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 20 14" aria-hidden className="rounded-[2px]">
      <rect width="20" height="14" fill="#012169" />
      <path d="M0 0l20 14M20 0L0 14" stroke="#fff" strokeWidth="2.8" />
      <path d="M0 0l20 14M20 0L0 14" stroke="#C8102E" strokeWidth="1.2" />
      <path d="M10 0v14M0 7h20" stroke="#fff" strokeWidth="4.6" />
      <path d="M10 0v14M0 7h20" stroke="#C8102E" strokeWidth="2.8" />
    </svg>
  );
}

// Switches locale with a soft (SPA) navigation and persists the choice in a
// long-lived cookie so it survives refreshes and future visits.
export function LangSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const switchTo = (target: Locale) => {
    if (target === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    const [, cleanPath] = splitLocalePath(pathname);
    const qs = search.toString();
    const href = localeHref(target, cleanPath) + (qs ? `?${qs}` : "");
    startTransition(() => {
      // scroll: false keeps the user where they were; replace avoids piling
      // language toggles onto the history stack.
      router.replace(href, { scroll: false });
    });
  };

  // On mobile the top bar is tight, so the switcher collapses to a single
  // "current locale + flag" pill that toggles the OTHER language on tap.
  // On sm+ it opens up into the classic segmented control with both flags.
  const other: Locale = locale === "bn" ? "en" : "bn";
  const otherLabel = other === "bn" ? "বাং" : "EN";
  const OtherFlag = other === "bn" ? FlagBD : FlagEN;

  return (
    <>
      {/* Mobile: one-tap toggle showing the language the user WOULD switch to. */}
      <button
        onClick={() => switchTo(other)}
        aria-label={`Switch to ${other === "bn" ? "Bangla" : "English"}`}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1.5 text-[12.5px] font-bold text-ink transition-colors hover:bg-brand-50 sm:hidden",
          pending && "opacity-60"
        )}
      >
        <OtherFlag />
        {otherLabel}
      </button>

      {/* sm+: segmented control with both languages visible. */}
      <div
        className={cn(
          "hidden items-center rounded-full border border-line bg-white p-0.5 text-[12.5px] font-bold sm:flex",
          pending && "opacity-60"
        )}
        role="group"
        aria-label="Language"
      >
        <button
          onClick={() => switchTo("bn")}
          aria-pressed={locale === "bn"}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors",
            locale === "bn" ? "bg-brand-600 text-white" : "text-ink-faint hover:text-ink"
          )}
        >
          <FlagBD />
          বাং
        </button>
        <button
          onClick={() => switchTo("en")}
          aria-pressed={locale === "en"}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors",
            locale === "en" ? "bg-brand-600 text-white" : "text-ink-faint hover:text-ink"
          )}
        >
          <FlagEN />
          EN
        </button>
      </div>
    </>
  );
}
