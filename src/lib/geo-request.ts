import "server-only";
import { getDistrictsForGeo, resolveDisplayDistrict } from "./data";
import type { GeoResult } from "./geo";
import type { Locale } from "./i18n";

// The server half of the handoff described in
// src/components/public/use-geo-query.ts.
//
// Every list API used to call detectArea() itself, which reads cookies() and
// headers(). That worked, but it meant three different handlers each resolved
// the visitor's location their own way, none of their responses could be shared
// in a CDN cache, and none of them could see the answer the BROWSER had already
// worked out — including an IP result the browser had cached for half an hour.
//
// Now the client sends what it knows and this turns it back into ranking
// fields. /api/doctors has always worked this way; this is that pattern lifted
// out so the rest of the routes cannot drift from it.

export type GeoRanking = {
  preferLat: number | null;
  preferLng: number | null;
  preferAreaId: number | null;
  preferDistrictId: number | null;
  priorityDistrictId: number | null;
};

export const EMPTY_RANKING: GeoRanking = {
  preferLat: null,
  preferLng: null,
  preferAreaId: null,
  preferDistrictId: null,
  priorityDistrictId: null,
};

function num(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Rebuild a GeoResult from the query string the client sent.
 *
 * Only ever district-level plus coordinates, because that is all
 * <LocationProvider> can know: a thana is something the visitor names, never
 * something we infer.
 */
async function geoFromParams(sp: URLSearchParams): Promise<GeoResult | null> {
  const slug = sp.get("preferDistrict");
  const lat = num(sp.get("preferLat"));
  const lng = num(sp.get("preferLng"));
  if (!slug && lat === null && lng === null) return null;

  // An unknown slug is dropped rather than trusted: this value reaches SQL
  // ranking clauses, and a stale cookie from a renamed district should degrade
  // to "no district" instead of erroring.
  const district = slug
    ? (await getDistrictsForGeo()).find((x) => x.slug === slug) ?? null
    : null;

  return {
    areaId: null,
    areaSlug: null,
    areaName: null,
    districtId: district?.id ?? null,
    districtSlug: district?.slug ?? null,
    // MLText allows nulls per language; GeoResult's narrower shape does not.
    // Only the presence of a name matters downstream (resolveDisplayDistrict
    // uses it to decide whether the visitor's own district can be named), so
    // drop the empty languages rather than widening GeoResult.
    districtName: district?.name
      ? {
          ...(district.name.bn ? { bn: district.name.bn } : {}),
          ...(district.name.en ? { en: district.name.en } : {}),
        }
      : null,
    lat,
    lng,
    source: district ? "district" : "ip-nearest",
  };
}

/**
 * Ranking fields for a listing, from the visitor's own location.
 *
 * `priorityDistrictOverride` is for the pages that ARE a place — a district or
 * thana listing. Someone on /districts/khulna/doctors is asking about Khulna,
 * so Khulna's curated order wins over theirs; their coordinates still decide
 * the order *within* it.
 */
export async function geoRankingFromParams(
  sp: URLSearchParams,
  locale: Locale,
  priorityDistrictOverride?: number | null
): Promise<GeoRanking> {
  const geo = await geoFromParams(sp);
  if (!geo) {
    return priorityDistrictOverride
      ? { ...EMPTY_RANKING, priorityDistrictId: priorityDistrictOverride }
      : EMPTY_RANKING;
  }

  // The district the site actually NAMES for this visitor, which is not their
  // own once theirs turns out to have no doctors. Ranking around an empty
  // district would list nothing they can book.
  const display = await resolveDisplayDistrict(geo, locale);
  const districtId = display?.id ?? geo.districtId;

  return {
    preferLat: geo.lat,
    preferLng: geo.lng,
    preferAreaId: null,
    preferDistrictId: districtId,
    priorityDistrictId: priorityDistrictOverride ?? districtId,
  };
}
