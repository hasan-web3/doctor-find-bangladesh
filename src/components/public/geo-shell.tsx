"use client";

import { useMemo } from "react";
import { useLocation } from "./location-provider";
import { GeoPrompt } from "./geo-prompt";
import { NoDoctorsNotice } from "./no-doctors-notice";
import { haversineKm } from "@/lib/location";
import { withPossessive } from "@/lib/bn";
import type { DistrictOption } from "./district-modal";
import type { Dict } from "@/lib/dict";
import type { Locale } from "@/lib/i18n";

// Everything the public layout used to compute on the server from detectArea().
//
// It all moved here because none of it can live in a CDN-cached document: the
// prompt depends on whether THIS visitor has answered, the "nearby" ordering
// depends on THEIR coordinates, and the substitution notice depends on the
// district THEY picked. Rendering any of it server-side is what forced all 24
// public routes to `ƒ Dynamic`.
//
// The district list itself is server-rendered and identical for everyone, so it
// stays in the cacheable payload and this component only re-orders it.

export type GeoShellDistrict = DistrictOption & {
  lat: number | null;
  lng: number | null;
};

export function GeoShell({
  districts,
  locale,
  d,
}: {
  districts: GeoShellDistrict[];
  locale: Locale;
  d: Pick<
    Dict,
    | "geo_viewing_from"
    | "geo_viewing_suffix"
    | "geo_change"
    | "geo_unknown"
    | "geo_choose_district"
    | "geo_no_doctors"
  >;
}) {
  const { location, ready } = useLocation();

  // Order the picker by the IP hint so the visitor's own district is usually
  // the first thing they see — the hint is unreliable enough to be a bad
  // *answer* but perfectly good as a *sort key*. With no usable coordinates we
  // keep the curated order from the DB.
  const ranked = useMemo<DistrictOption[]>(() => {
    const hintLat = location.source === "ip" ? location.lat : null;
    const hintLng = location.source === "ip" ? location.lng : null;
    if (hintLat === null || hintLng === null) {
      return districts.map(({ lat: _lat, lng: _lng, ...rest }) => ({ ...rest, nearby: false }));
    }
    return districts
      .map((x) => ({
        x,
        // Districts with no coords sort last rather than to the equator.
        dist:
          x.lat !== null && x.lng !== null
            ? haversineKm(hintLat, hintLng, x.lat, x.lng)
            : Number.POSITIVE_INFINITY,
      }))
      .sort((a, b) => a.dist - b.dist)
      .map(({ x }, i) => ({
        slug: x.slug,
        name: x.name,
        nameEn: x.nameEn,
        doctorCount: x.doctorCount,
        nearby: i < 3,
      }));
  }, [districts, location.source, location.lat, location.lng]);

  // The visitor picked a district that has no doctors yet, so every list on the
  // site is quietly showing another district's. Name the nearest district that
  // actually has doctors — that is where the substituted results come from.
  const substitution = useMemo(() => {
    if (location.source !== "manual" || !location.districtSlug) return null;
    const own = districts.find((x) => x.slug === location.districtSlug);
    if (!own || own.doctorCount > 0) return null;

    const withDoctors = districts.filter((x) => x.doctorCount > 0);
    if (withDoctors.length === 0) return null;

    const nearest =
      own.lat !== null && own.lng !== null
        ? withDoctors
            .filter((x) => x.lat !== null && x.lng !== null)
            .sort(
              (a, b) =>
                haversineKm(own.lat!, own.lng!, a.lat!, a.lng!) -
                haversineKm(own.lat!, own.lng!, b.lat!, b.lng!)
            )[0] ?? withDoctors[0]
        : withDoctors[0];

    return { chosen: own.name, shown: nearest.name, shownSlug: nearest.slug };
  }, [districts, location.source, location.districtSlug]);

  // Nothing renders until resolution finishes: the server HTML contains neither
  // the prompt nor the notice, so painting either before `ready` would be a
  // hydration mismatch, and painting it after is exactly the intended behaviour.
  if (!ready) return null;

  const noDoctorsMessage = substitution
    ? d.geo_no_doctors
        .replace("{a}", substitution.chosen)
        .replace("{b}", locale === "bn" ? withPossessive(substitution.shown) : substitution.shown)
    : "";

  return (
    <>
      <GeoPrompt
        hasDistrict={location.source === "manual"}
        districtName={location.source === "ip" ? location.districtName : null}
        districts={ranked}
        d={d}
      />
      {substitution && (
        <NoDoctorsNotice
          message={noDoctorsMessage}
          pairKey={`${location.districtSlug ?? ""}|${substitution.shownSlug}`}
        />
      )}
    </>
  );
}
