import { permanentRedirect } from "next/navigation";
import { localeHref, isLocale } from "@/lib/i18n";

// ISR: redirect stub.
export const revalidate = 86400;

// /area used to render a byte-identical copy of /areas with a different
// canonical tag — two URLs, one page, and Google picked its own winner
// ("Duplicate, Google chose different canonical than user" in GSC).
// The navbar and bottom nav both link to /areas, so that is the canonical
// one; this stub keeps old links and backlinks alive with a 308.
// NOTE: /area/doctors/[district]/[area] is a different, real route and is
// unaffected — only the bare /area index redirects.
type Props = { params: Promise<{ locale: string }> };

export default async function AreaIndexRedirect({ params }: Props) {
  const { locale } = await params;
  const loc = isLocale(locale) ? locale : "bn";
  permanentRedirect(localeHref(loc, "/areas"));
}
