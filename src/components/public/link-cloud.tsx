import Link from "next/link";
import { num, type Locale } from "@/lib/i18n";
import type { HubLink } from "@/lib/data";

// ---------------------------------------------------------------------------
// A block of crawlable internal links.
//
// Deliberately a SERVER component with real <Link> (i.e. real <a href>)
// elements: the whole reason this exists is that the filter sidebar is
// client-side state and renders no anchors, so Googlebot had no way to reach
// the thana and specialty landing pages from a hub. Anything rendered here ends
// up in the cached HTML and is followed on the first crawl.
//
// Responsive by construction: the chips are a wrapping flex row, so the block
// reflows from one column on a narrow phone to several per line on desktop
// without a single media query or fixed height.
// ---------------------------------------------------------------------------

export function LinkCloud({
  title,
  description,
  items,
  href,
  locale,
  countSuffix,
  limit = 24,
  moreHref,
  moreLabel,
  headingLevel = "h2",
}: {
  title: string;
  description?: string;
  items: HubLink[];
  /** Build the destination for one item. */
  href: (item: HubLink) => string;
  locale: Locale;
  /** Localized unit printed after the doctor count, e.g. "জন ডাক্তার". */
  countSuffix: string;
  limit?: number;
  moreHref?: string;
  moreLabel?: string;
  headingLevel?: "h2" | "h3";
}) {
  if (items.length === 0) return null;

  const Heading = headingLevel;
  const shown = items.slice(0, limit);

  return (
    <section className="mt-4 rounded-2xl border border-line bg-white p-5 sm:p-6">
      <Heading className="mb-1.5 mt-0 font-heading text-[19px] font-bold text-ink sm:text-[22px]">
        {title}
      </Heading>
      {description && (
        <p className="mb-4 mt-0 max-w-[760px] text-[14.5px] leading-relaxed text-ink-mute">
          {description}
        </p>
      )}

      <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
        {/* `slug` alone is not unique as a key: the popular-searches block lists
            the same specialty in several thanas, so the second slug has to be
            part of it or React reuses the wrong node. */}
        {shown.map((item) => (
          <li key={`${item.slug}-${item.slug2 ?? ""}-${item.district_slug ?? ""}`}>
            <Link
              href={href(item)}
              // min-h-11 = 44px, the minimum touch target. Chips that carry a
              // count badge clear it on their own; the ones without (popular
              // searches, recent doctors) came out at 41px without this.
              className="group flex min-h-11 items-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:border-brand-600 hover:bg-brand-600 hover:text-white"
            >
              <span className="leading-snug">
                {item.name}
                {item.context ? (
                  // The parent place (district for a thana, thana for a
                  // hospital). Keeps two identically named thanas in different
                  // districts distinguishable, for a reader and for Google.
                  <span className="font-normal opacity-70">, {item.context}</span>
                ) : null}
              </span>
              {item.doctor_count > 0 && (
                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-bold text-brand-700 transition-colors group-hover:bg-white/25 group-hover:text-white">
                  {num(item.doctor_count, locale)}
                  <span className="sr-only"> {countSuffix}</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {moreHref && moreLabel && items.length > shown.length && (
        <Link
          href={moreHref}
          className="mt-4 inline-block text-sm font-bold text-brand-600 hover:underline"
        >
          {moreLabel}
        </Link>
      )}
    </section>
  );
}
