"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocation } from "./location-provider";
import { GeoBanner } from "./geo-banner";
import { DistrictModal, type DistrictOption } from "./district-modal";
import type { Dict } from "@/lib/dict";

// The two surfaces back off on separate clocks, because they cost the visitor
// very different amounts of attention.
//
// The modal blocks the page, so dismissing it buys a long silence: a week
// before it interrupts again on its own. The strip is a one-line bar that is
// trivial to ignore, so it comes back on a much shorter cycle — it is the
// standing reminder that we are still guessing.
//
// Neither timer applies to the strip's "পরিবর্তন করুন" button: that is the
// visitor asking us, and an explicit request always opens the modal.
const MODAL_SNOOZE_KEY = "geo_modal_snooze_until";
const MODAL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

const BANNER_SNOOZE_KEY = "geo_banner_snooze_until";
const BANNER_SNOOZE_MS = 5 * 60 * 60 * 1000;

// Let the page paint and settle first. The modal is client-only and fixed
// position, so it is invisible to crawlers and cannot shift layout — this
// delay is purely so a visitor sees what the site *is* before being asked
// anything.
const MODAL_DELAY_MS = 1500;

// Where the ask is worth making: pages whose entire value is "what is near
// me". A doctor or hospital profile is deliberately excluded — the visitor
// arrived with a specific person in mind (usually straight from search), and
// nearest-first ranking changes nothing on that page, so a modal there is
// pure interruption. Same for policy, blog and contact pages.
const ELIGIBLE = [
  /^\/$/,
  /^\/doctors$/,
  /^\/hospitals$/,
  /^\/specialties$/,
  /^\/specialties\/[^/]+$/,
  /^\/districts$/,
  /^\/districts\/[^/]+\/doctors$/,
  /^\/areas$/,
  /^\/area\/doctors\/[^/]+\/[^/]+$/,
];

// Bangla lives at the root (/doctors), English under /en (/en/doctors), so the
// prefix has to come off before the path can be matched.
function neutralPath(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3) || "/";
  return pathname;
}

function snoozedNow(key: string): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until) || until <= Date.now()) {
      window.localStorage.removeItem(key);
      return false;
    }
    return true;
  } catch {
    // Safari private mode throws on storage access. Failing "not snoozed"
    // keeps the prompt working; failing the other way would silently disable
    // location for everyone with storage blocked.
    return false;
  }
}

function snooze(key: string, ms: number) {
  try {
    window.localStorage.setItem(key, String(Date.now() + ms));
  } catch {
    /* storage unavailable — the in-memory state still hides it for this view */
  }
}

export function GeoPrompt({
  hasDistrict,
  districtName,
  districts,
  d,
}: {
  /** The visitor already answered — nothing to ask, nothing to show. */
  hasDistrict: boolean;
  /** IP-guessed district, district granularity only. Null when unknown. */
  districtName: string | null;
  districts: DistrictOption[];
  d: Pick<
    Dict,
    "geo_viewing_from" | "geo_viewing_suffix" | "geo_change" | "geo_unknown" | "geo_choose_district"
  >;
}) {
  // Both start closed so the server-rendered markup and the first client paint
  // agree; the effect below is what opens either one.
  const [modalOpen, setModalOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const pathname = usePathname();
  const { setDistrict } = useLocation();

  const eligible = ELIGIBLE.some((re) => re.test(neutralPath(pathname)));

  useEffect(() => {
    if (hasDistrict) return;

    const bannerSnoozed = snoozedNow(BANNER_SNOOZE_KEY);

    // The modal auto-opens only on its own clock and only where the ask is
    // worth making. Everywhere else the strip stands in for it.
    if (!snoozedNow(MODAL_SNOOZE_KEY) && eligible) {
      const timer = window.setTimeout(() => setModalOpen(true), MODAL_DELAY_MS);
      return () => window.clearTimeout(timer);
    }

    setBannerOpen(!bannerSnoozed);
  }, [hasDistrict, eligible, pathname]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    // A week before it interrupts on its own again. This runs for a manually
    // reopened modal too, which is harmless — it was already snoozed, and
    // "পরিবর্তন করুন" ignores the timer anyway.
    snooze(MODAL_SNOOZE_KEY, MODAL_SNOOZE_MS);
    // Hand off to the strip — always, even with no IP guess to show, because
    // the strip is the only route back to the picker once the modal is gone.
    // Skipped when the strip is inside its own 5-hour back-off: dismissing the
    // strip while the modal was open must not be undone by closing the modal.
    if (!snoozedNow(BANNER_SNOOZE_KEY)) setBannerOpen(true);
  }, []);

  const closeBanner = useCallback(() => {
    setBannerOpen(false);
    snooze(BANNER_SNOOZE_KEY, BANNER_SNOOZE_MS);
  }, []);

  const pick = useCallback(
    (slug: string) => {
      // Purely client-side now: the cookie is written in the browser and every
      // geo-aware surface reads it from LocationProvider's context. There is
      // no server round trip and no router.refresh() — the page HTML is
      // canonical and identical for every visitor, so re-fetching it would
      // return byte-for-byte the same document.
      //
      // The slug is validated against the district list the server already
      // sent, so an unknown value can never reach the cookie.
      setDistrict(slug);
      setModalOpen(false);
      setBannerOpen(false);
    },
    [setDistrict]
  );

  if (hasDistrict) return null;

  return (
    <>
      {bannerOpen && (
        <GeoBanner
          districtName={districtName}
          onChange={() => setModalOpen(true)}
          onDismiss={closeBanner}
          d={d}
        />
      )}
      {modalOpen && (
        <DistrictModal
          districts={districts}
          onPick={pick}
          onClose={closeModal}
          // Writing a cookie is synchronous — the modal closes in the same
          // tick, so there is no in-flight state left to show.
          pending={false}
        />
      )}
    </>
  );
}
