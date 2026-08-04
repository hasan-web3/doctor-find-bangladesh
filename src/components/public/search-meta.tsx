"use client";

import { num, type Locale } from "@/lib/i18n";

// Two small pieces shared by every public listing search box.
//
// They are deliberately NOT a wrapper around the <input> itself: each listing
// already has its own input styling (pill-shaped on /areas, boxed on the doctor
// lists), and swapping those for one component would have changed the look of
// six pages. These just slot into the markup that is already there.

// Clear (✕) button. Sits inside the existing `relative` wrapper, mirroring the
// search icon on the left. Rendered only when there is something to clear, so
// the field looks untouched until the visitor types.
export function ClearSearchButton({
  onClear,
  label,
  className = "right-3",
}: {
  onClear: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={label}
      title={label}
      className={`absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[15px] leading-none text-ink-faint transition-colors hover:bg-page hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand-500 ${className}`}
    >
      ✕
    </button>
  );
}

// "৬৭টি এলাকা পাওয়া গেছে" / "67 areas found".
//
// Shown only while a search or filter is active: with no filter the number is
// just the full directory size, which tells the visitor nothing. When the
// result set is empty the listings already render their own "nothing found"
// message, so this stays quiet rather than saying "0 found" twice.
//
// `template` comes from the dictionary and carries the {n} placeholder, which
// is what keeps the Bangla classifier ("টি" for places, "জন" for people)
// correct per entity type.
export function SearchResultCount({
  count,
  active,
  template,
  locale,
  className = "",
}: {
  count: number;
  active: boolean;
  template: string;
  locale: Locale;
  className?: string;
}) {
  if (!active || count <= 0) return null;
  return (
    <p
      aria-live="polite"
      className={`mt-2 text-[13.5px] font-medium text-ink-mute ${className}`}
    >
      {template.replace("{n}", num(count, locale))}
    </p>
  );
}
