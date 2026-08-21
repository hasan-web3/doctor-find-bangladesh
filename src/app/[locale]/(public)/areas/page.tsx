import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { searchAreas, resolveDisplayDistrict } from "@/lib/data";
import { buildMetadata } from "@/lib/seo";
import { getDict } from "@/lib/dict";
import { isLocale, type Locale } from "@/lib/i18n";
import { AreaListClient } from "@/components/public/area-list-client";
import { STATIC_GEO } from "@/lib/geo";

// ISR: hub; on-demand revalidated on mutation. 24h is the no-change ceiling.
export const revalidate = 86400;

// No `searchParams` in Props on purpose. Awaiting searchParams anywhere in a
// route — page body OR generateMetadata — forces `ƒ Dynamic` and a full render
// per request. The server now always renders the canonical first page, and
// <AreaListClient> applies ?q=/?page=/?perPage= after mount by re-fetching from
// the cached API route. Pagination stays shareable and back-button-able because
// the URL is still the source of truth; only the *reader* moved to the client.
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({
    locale,
    path: "/areas",
    title: locale === "bn" ? "এলাকা অনুযায়ী ডাক্তার" : "Doctors by Area",
    // National, like the page itself. It used to say "of Khulna" while the
    // listing covers thanas from every district.
    description:
      locale === "bn"
        ? "প্রতিটি এলাকার যাচাইকৃত ডাক্তার ও চেম্বারের তালিকা। আপনার কাছের এলাকা বেছে নিন।"
        : "Verified doctors and chambers for every area. Pick the area nearest to you.",
  });
}

export default async function AreasPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const d = getDict(locale);

  const geo = STATIC_GEO;
  const display = await resolveDisplayDistrict(geo, locale);
  // Canonical first page — identical for every visitor, so it caches.
  const initialAreasData = await searchAreas({
    page: 1,
    perPage: 24,
    preferLat: geo.lat,
    preferLng: geo.lng,
    preferAreaId: geo.areaId,
    // The district we NAME in the copy below, which is not the visitor's own
    // once theirs turns out to have no doctors. Ranking by their empty
    // district would list thanas from a district this page never mentions.
    preferDistrictId: display?.id ?? geo.districtId,
  }, locale);

  // Names no district, for the same reason /districts does not: this grid holds
  // thanas from every district that has doctors, so a single district name in
  // the caption contradicted the cards under it — the line said বরগুনা while
  // every visible card said খুলনা. `display` still ranks the grid; it just no
  // longer claims to describe it.
  const areaSub = d.sec_area_sub;

  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <Breadcrumbs locale={locale} items={[{ name: d.breadcrumb_home, path: "/" }, { name: d.nav_areas }]} />
      <h1 className="mb-1.5 font-heading text-[clamp(26px,4vw,34px)] font-bold text-ink">{d.sec_area_title}</h1>
      <p className="mb-8 text-base text-ink-mute">{areaSub}</p>

      <AreaListClient
        locale={locale}
        initialAreas={initialAreasData.rows}
        initialTotal={initialAreasData.total}
      />
    </div>
  );
}
