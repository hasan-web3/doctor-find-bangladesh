import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { ToolsIndexClient, type ToolCardData } from "@/components/public/tools/tools-index-client";
import { ToolDisclaimer } from "@/components/public/tools/tool-disclaimer";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { siteUrl } from "@/lib/seo-utils";
import { getDict } from "@/lib/dict";
import { TOOLS, enabledTools, type ToolCategory, type ToolDef } from "@/lib/tools/registry";
import { getToolCopy, pick, type ToolCopy } from "@/lib/tools/copy";
import { isLocale, localeHref, type Locale } from "@/lib/i18n";

// ISR. Nothing on this page is per-visitor and nothing here is even per-DAY:
// the only input is the admin's on/off map, which arrives through the
// `settings` tag and purges this page the moment it changes.
export const revalidate = 86400;

type Props = { params: Promise<{ locale: string }> };

const CATEGORY_KEY: Record<ToolCategory, keyof ToolCopy> = {
  body: "cat_body",
  maternity: "cat_maternity",
  child: "cat_child",
  lifestyle: "cat_lifestyle",
};

// One flattened card. Both languages go into `haystack` so the search box
// matches "bmi" typed on a Latin keyboard while the page is in Bangla — which
// is how most Bangladeshi visitors actually search.
function toCard(t: ToolDef, locale: Locale, c: ToolCopy): ToolCardData {
  return {
    key: t.key,
    slug: t.slug,
    name: pick(t.name, locale),
    tagline: pick(t.tagline, locale),
    icon: t.icon,
    bg: t.bg,
    fg: t.fg,
    category: t.category,
    categoryLabel: c[CATEGORY_KEY[t.category]],
    haystack: [
      t.name.bn,
      t.name.en,
      t.tagline.bn,
      t.tagline.en,
      ...t.keywords.bn,
      ...t.keywords.en,
      t.slug.replace(/-/g, " "),
    ]
      .join(" ")
      .toLowerCase(),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const c = getToolCopy(locale);
  return buildMetadata({
    locale,
    path: "/tools",
    title: c.index_heading,
    description: c.index_sub,
    ogTitle: c.index_heading,
    ogSubtitle: c.index_title,
  });
}

export default async function ToolsIndexPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const c = getToolCopy(locale);
  const d = getDict(locale);
  const settings = await getSettings();

  const live = enabledTools(settings.tools_enabled);
  const planned = TOOLS.filter((t) => t.status === "planned").sort((a, b) => a.sort - b.sort);

  // Every tool switched off means an empty hub with nothing to say. 404 rather
  // than serve a shell — an indexed page listing nothing is worse than no page,
  // and the sitemap already drops /tools in the same situation.
  if (live.length === 0) notFound();

  const tools = live.map((t) => toCard(t, locale, c));
  const plannedCards = planned.map((t) => toCard(t, locale, c));

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8">
      <Breadcrumbs
        locale={locale}
        items={[
          { name: d.nav_home, path: "/" },
          { name: c.index_title },
        ]}
      />

      {/* ItemList tells Google this URL is a hub over N named tools and gives
          each one its canonical URL — a second discovery path into the tool
          pages alongside the sitemap and the navbar. Only the LIVE ones are
          listed, because structured data must describe what the page shows. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: c.index_heading,
          description: c.index_sub,
          numberOfItems: tools.length,
          itemListElement: tools.map((t, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: t.name,
            url: siteUrl(localeHref(locale, `/tools/${t.slug}`)),
          })),
        }}
      />

      <header className="mb-7 max-w-[640px]">
        <h1 className="mb-2.5 mt-0 font-heading text-[clamp(26px,4.5vw,36px)] font-bold leading-tight text-ink">
          {c.index_heading}
        </h1>
        <p className="m-0 text-[16px] leading-[1.8] text-ink-mute">{c.index_sub}</p>
      </header>

      <ToolsIndexClient locale={locale} tools={tools} planned={plannedCards} />

      <div className="mt-10">
        <ToolDisclaimer locale={locale} />
      </div>
    </div>
  );
}
