import { permanentRedirect } from "next/navigation";
import { localeHref, isLocale } from "@/lib/i18n";

// ISR: redirect stub.
export const revalidate = 86400;

// Empty list = prebuild nothing, but mark the route statically generatable so
// Next serves it as ISR: first request renders and caches, later requests hit
// the cache. Without this a dynamic segment is re-rendered on every request.
export function generateStaticParams() {
  return [];
}


// The canonical district doctor-listing lives at /districts/[slug]/doctors —
// the URL Google indexes and the internal links point to. This stub keeps
// any old bookmarks or backlinks working with a 308 to the canonical path.
type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function DistrictRedirect({ params }: Props) {
  const { locale, slug } = await params;
  const loc = isLocale(locale) ? locale : "bn";
  permanentRedirect(localeHref(loc, `/districts/${slug}/doctors`));
}
