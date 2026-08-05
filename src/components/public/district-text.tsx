"use client";

import { useShownDistrict } from "@/components/public/shown-district-context";
import { withPossessive } from "@/lib/bn";
import type { Locale } from "@/lib/i18n";

// A line of copy with the district name in it, kept in step with the doctors
// actually listed on the page.
//
// The homepage is static ISR, so the server bakes in the CANONICAL district —
// whichever one the top-ranked doctor happens to be in. That was fine while
// every doctor was in Khulna; the moment a Dhaka doctor ranked first, a visitor
// who had chosen Khulna saw "ঢাকার #১ ডাক্তার ডিরেক্টরি" over a Khulna list.
//
// Templates rather than a render prop, because a server component cannot pass a
// function to a client one. `{d}` is where the district name goes.

export function DistrictText({
  template,
  fallback,
  locale,
  /** Apply Bangla possessive inflection ("খুলনা" -> "খুলনার"). */
  possessive = true,
  className,
  as = "span",
}: {
  /** Copy containing `{d}`, used when a district is known. */
  template: string;
  /** Copy used when no district can be named at all. */
  fallback: string;
  locale: Locale;
  possessive?: boolean;
  className?: string;
  /** Headings are included so a page title can follow the list under it. The
   *  server still renders the canonical district into the tag, so the <h1> a
   *  crawler sees is complete and identical for everyone. */
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3";
}) {
  const { name } = useShownDistrict();
  const Tag = as;

  const text = name
    ? template.replace("{d}", locale === "bn" && possessive ? withPossessive(name) : name)
    : fallback;

  return <Tag className={className}>{text}</Tag>;
}
