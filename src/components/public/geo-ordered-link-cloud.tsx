"use client";

import { useMemo } from "react";
import { LinkCloud } from "@/components/public/link-cloud";
import { useShownDistrict } from "@/components/public/shown-district-context";
import type { Locale } from "@/lib/i18n";
import type { HubLink } from "@/lib/data";

// A LinkCloud whose items are re-ordered to put the visitor's district first.
//
// Unlike <GeoLinkClouds> this makes NO request. The server already ships a
// district-tagged list inside the cached HTML, so following the visitor only
// needs a client-side sort, which costs nothing and cannot fail. Use this
// whenever the full candidate set is small enough to ship; use GeoLinkClouds
// when it is not.
//
// The ordering is stable: within each group the server's ranking (doctor count,
// then curated sort) is preserved, so this only lifts the relevant district to
// the top rather than reshuffling everything.
export function GeoOrderedLinkCloud({
  title,
  description,
  items,
  hrefTemplate,
  locale,
  countSuffix,
  limit = 24,
  moreHref,
  moreLabel,
}: {
  title: string;
  description?: string;
  items: HubLink[];
  /**
   * Destination as a SERIALIZABLE template, not a function: this is a Client
   * Component, and React cannot send a closure across the server boundary.
   * The server passes an already locale-prefixed path containing `{slug}`
   * and/or `{district_slug}`, e.g. `/en/specialties/gynecology/{slug}`.
   */
  hrefTemplate: string;
  locale: Locale;
  countSuffix: string;
  limit?: number;
  moreHref?: string;
  moreLabel?: string;
}) {
  const { slug: shownSlug } = useShownDistrict();

  const ordered = useMemo(() => {
    if (!shownSlug) return items;
    const mine: HubLink[] = [];
    const rest: HubLink[] = [];
    for (const item of items) {
      (item.district_slug === shownSlug ? mine : rest).push(item);
    }
    // Nothing here belongs to the visitor's district, so there is nothing to
    // lift. Returning the original array keeps the reference stable.
    if (mine.length === 0) return items;
    return [...mine, ...rest];
  }, [items, shownSlug]);

  return (
    <LinkCloud
      title={title}
      description={description}
      items={ordered}
      href={(item) =>
        hrefTemplate
          .replace("{district_slug}", item.district_slug ?? "")
          .replace("{slug}", item.slug)
      }
      locale={locale}
      countSuffix={countSuffix}
      limit={limit}
      moreHref={moreHref}
      moreLabel={moreLabel}
    />
  );
}
