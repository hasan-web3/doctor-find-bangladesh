import { permanentRedirect } from "next/navigation";
import { localeHref, isLocale } from "@/lib/i18n";

// The canonical district doctor-listing lives at /districts/[slug]/doctors —
// the URL Google indexes and the internal links point to. This stub keeps
// any old bookmarks or backlinks working with a 308 to the canonical path.
type Props = { params: Promise<{ locale: string; slug: string }> };

export default async function DistrictRedirect({ params }: Props) {
  const { locale, slug } = await params;
  const loc = isLocale(locale) ? locale : "bn";
  permanentRedirect(localeHref(loc, `/districts/${slug}/doctors`));
}
