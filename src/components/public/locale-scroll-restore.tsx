"use client";

import { useLocaleScrollRestore } from "@/lib/use-locale-persistence";

// Client-side sibling of the layout: consumes the scroll snapshot the
// language switcher stashes and re-applies it after the fresh page tree
// paints. Rendering nothing is intentional.
export function LocaleScrollRestore() {
  useLocaleScrollRestore();
  return null;
}
