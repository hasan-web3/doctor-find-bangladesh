"use client";

import { useShownDistrict } from "@/components/public/shown-district-context";
import { withPossessive } from "@/lib/bn";
import { num, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";

// The <h1> and sub-line on /doctors.
//
// The list underneath is <DoctorListClient>, which re-queries /api/doctors for
// the visitor's district. If this heading stayed on the server it would be
// pinned to the canonical district, so a Dhaka visitor would read "খুলনার
// ডাক্তারদের তালিকা" above a grid of Dhaka doctors.
//
// The canonical strings are still what the server renders into the HTML, so
// Googlebot and first paint get a complete, sensible heading; this only swaps
// the district name once the visitor's own location is known.

export function DoctorsPageHeading({
  canonicalDistrictName,
  total,
  locale,
  d,
}: {
  /** District named in the server-rendered HTML; the fallback until we know better. */
  canonicalDistrictName: string | null;
  /** Site-wide verified-doctor count from the canonical query. */
  total: number;
  locale: Locale;
  d: Pick<Dict, "listing_sub_prefix" | "listing_sub_empty">;
}) {
  // The district of the cards actually on screen, published by
  // <DoctorListClient>. NOT the visitor's own district: preferDistrict ranks
  // rather than filters, so a visitor whose district has no doctors still sees
  // another district's cards and the heading has to say so.
  const { name } = useShownDistrict();
  const districtName = name || canonicalDistrictName;

  const title = districtName
    ? locale === "bn"
      ? `${withPossessive(districtName)} ডাক্তারদের তালিকা`
      : `Doctors in ${districtName}`
    : locale === "bn"
      ? "আপনার এলাকার ডাক্তারদের তালিকা"
      : "Doctors in Your Area";

  // `total` deliberately stays the server's number: the sentence reads "from
  // among N verified doctors, pick the best in <district>", so N is the
  // site-wide pool, not the filtered result count.
  const sub =
    total > 0
      ? districtName
        ? locale === "bn"
          ? `${num(total, locale)} জন যাচাইকৃত ডাক্তারের মধ্যে থেকে ${withPossessive(districtName)} সেরা ডাক্তারদের বেছে নিন।`
          : `Choose from ${num(total, locale)} verified doctors in ${districtName}.`
        : `${num(total, locale)} ${d.listing_sub_prefix}`
      : d.listing_sub_empty;

  return (
    <>
      <h1 className="mb-1.5 font-heading text-[clamp(26px,4vw,34px)] font-bold text-ink">{title}</h1>
      <p className="mb-6 text-base text-ink-mute">{sub}</p>
    </>
  );
}
