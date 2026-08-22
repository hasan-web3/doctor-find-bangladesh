import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { FaqAccordion } from "@/components/public/faq-accordion";
import { LinkCloud } from "@/components/public/link-cloud";
import { Icon } from "@/components/icons";
import { ToolRunner } from "@/components/public/tools/tool-runner";
import { ToolDisclaimer } from "@/components/public/tools/tool-disclaimer";
import { RelatedTools } from "@/components/public/tools/related-tools";
import { getSpecialties, type HubLink } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { ldFaq, ldHealthTool, ldMedicalWebPage, brandIdentity, siteUrl } from "@/lib/seo-utils";
import { getDict } from "@/lib/dict";
import {
  LIVE_TOOLS,
  TOOLS_LAST_REVIEWED,
  isToolOn,
  toolBySlug,
} from "@/lib/tools/registry";
import { getToolCopy, pick } from "@/lib/tools/copy";
import { isLocale, localeHref, type Locale } from "@/lib/i18n";

export const revalidate = 86400;

// Every live tool is prerendered at build time, for BOTH locales, from the
// registry alone — no database round-trip, so these pages exist even on a build
// with no DB reachable.
//
// Deliberately NOT filtered by the admin toggles. generateStaticParams runs at
// build time while the toggles change at runtime, so filtering here would bake
// a build-time snapshot into the route table and a tool switched back on would
// 404 until the next deploy. The page body checks isToolOn() instead, and a
// settings save purges these pages through the `settings` tag.
export function generateStaticParams() {
  return LIVE_TOOLS.map((t) => ({ slug: t.slug }));
}

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const tool = toolBySlug(slug);
  if (!tool || tool.status !== "live") return {};

  const name = pick(tool.name, locale);
  const tagline = pick(tool.tagline, locale);
  // The description is the tagline plus the first sentence of the purpose
  // block, so the SERP snippet says what the tool does AND what it is based on
  // rather than repeating the title.
  const purpose = pick(tool.purpose, locale);
  const description = `${tagline}. ${purpose}`.slice(0, 300);

  return buildMetadata({
    locale,
    path: `/tools/${tool.slug}`,
    title: name,
    description,
    // The generated /api/og card carries the tool's own name and tagline, so a
    // link pasted into Messenger or WhatsApp previews as that specific tool.
    ogTitle: name,
    ogSubtitle: tagline,
  });
}

export default async function ToolPage({ params }: Props) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;

  const tool = toolBySlug(slug);
  if (!tool) notFound();

  const [settings, specialties] = await Promise.all([getSettings(), getSpecialties(locale)]);

  // Switched off in the dashboard, or not implemented yet: the URL must stop
  // resolving, not render an empty shell. The sitemap drops it in the same
  // breath (see the `tools` section in sitemap-core.ts), so the two never
  // disagree about which tool URLs exist.
  if (!isToolOn(tool, settings.tools_enabled)) notFound();

  const c = getToolCopy(locale);
  const d = getDict(locale);
  const identity = brandIdentity(settings.site_name, settings.brand_name);
  const name = pick(tool.name, locale);
  const tagline = pick(tool.tagline, locale);
  const purpose = pick(tool.purpose, locale);
  const source = pick(tool.source, locale);
  const url = siteUrl(localeHref(locale, `/tools/${tool.slug}`));

  // Brand logo for the share card, routed through Next's image optimizer.
  //
  // That indirection is required, not cosmetic: the logo lives in an R2 bucket
  // that sends no Access-Control-Allow-Origin header, and drawing a
  // cross-origin image onto a canvas taints it so that every later toBlob()
  // throws. /_next/image re-serves the same file from our own origin, and
  // same-origin images never taint. If nothing is uploaded the card falls back
  // to the brand name in text.
  const rawLogo = settings.logo_desktop_url || settings.logo_mobile_url || "";
  const cardLogoUrl = rawLogo
    ? `/_next/image?url=${encodeURIComponent(rawLogo)}&w=384&q=90`
    : "";

  // Related specialists. The registry lists candidate slugs; only the ones that
  // exist in the live specialty table AND actually have a doctor behind them
  // survive, in the registry's own order of relevance. That is what stops a
  // result from handing the visitor a link to an empty landing page.
  const bySlug = new Map(specialties.map((s) => [s.slug, s]));
  const relatedSpecialties: HubLink[] = tool.specialties
    .map((s) => bySlug.get(s))
    .filter((s): s is NonNullable<typeof s> => !!s && s.doctor_count > 0)
    .map((s) => ({ slug: s.slug, name: s.name, doctor_count: s.doctor_count }));

  const faqs = tool.faqs.map((f, i) => ({
    id: i + 1,
    question: pick(f.q, locale),
    answer: pick(f.a, locale),
  }));

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8">
      <Breadcrumbs
        locale={locale}
        items={[
          { name: d.nav_home, path: "/" },
          { name: c.index_title, path: "/tools" },
          { name },
        ]}
      />

      <JsonLd
        data={[
          ldMedicalWebPage({
            name,
            description: `${tagline}. ${purpose}`,
            url,
            locale,
            about: tool.name.en,
            citation: tool.source.en,
            identity,
            lastReviewed: TOOLS_LAST_REVIEWED,
          }),
          ldHealthTool({ name, description: tagline, url, identity }),
          ...(faqs.length > 0 ? [ldFaq(faqs)] : []),
        ]}
      />

      <header className="mb-6 flex items-start gap-4">
        <span
          className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl sm:flex"
          style={{ background: tool.bg, color: tool.fg }}
          aria-hidden
        >
          <Icon name={tool.icon} size={29} />
        </span>
        <div className="min-w-0">
          <h1 className="mb-1.5 mt-0 font-heading text-[clamp(24px,4.2vw,34px)] font-bold leading-tight text-ink">
            {name}
          </h1>
          <p className="m-0 text-[16px] leading-relaxed text-ink-mute">{tagline}</p>
        </div>
      </header>

      {/* The guide. Sits ABOVE the calculator on purpose: it is the part a
          crawler can read without running JavaScript, and the part that tells a
          visitor whether this is the tool they wanted before they start typing. */}
      <section className="mb-6 rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="mb-2 mt-0 flex items-center gap-2 font-heading text-[16px] font-bold text-ink">
          <Icon name="book" size={18} className="text-brand-600" />
          {c.tool_guide_title}
        </h2>
        <p className="m-0 text-[15px] leading-[1.85] text-ink-mute">{purpose}</p>
      </section>

      {/* the calculator */}
      <section className="mb-8">
        <h2 className="sr-only">{c.tool_result_title}</h2>
        <ToolRunner
          toolKey={tool.key}
          locale={locale}
          brandName={identity.name}
          logoUrl={cardLogoUrl}
        />
      </section>

      {/* provenance — the citation the MedicalWebPage markup points at, shown
          rather than only declared */}
      <section className="mb-6 rounded-xl border border-line bg-page px-4 py-3.5">
        <div className="mb-1 flex items-center gap-2 text-[13.5px] font-bold text-ink-soft">
          <Icon name="shield" size={16} className="text-brand-600" />
          {c.tool_source_title}
        </div>
        <p className="m-0 text-[13.5px] leading-[1.75] text-ink-mute">{source}</p>
      </section>

      <div className="mb-9">
        <ToolDisclaimer locale={locale} />
      </div>

      {/* Hand-off into the directory. This is the point of putting calculators
          on a doctor directory at all: a result the visitor cares about, and
          then the specialists who can talk about it. */}
      {relatedSpecialties.length > 0 && (
        <div className="mb-9">
          <LinkCloud
            title={c.tool_related_doctors}
            description={c.tool_related_doctors_sub}
            items={relatedSpecialties}
            href={(s) => localeHref(locale, `/specialties/${s.slug}`)}
            locale={locale}
            countSuffix={d.doctors_unit}
            moreHref={localeHref(locale, "/doctors")}
            moreLabel={d.view_all_doctors}
          />
        </div>
      )}

      {faqs.length > 0 && (
        <section className="mb-9">
          <h2 className="mb-4 mt-0 font-heading text-[21px] font-bold text-ink">{c.tool_faq_title}</h2>
          <FaqAccordion faqs={faqs} headingLevel="h3" />
        </section>
      )}

      <RelatedTools locale={locale} exclude={[tool.key]} limit={3} />

      <div className="mt-8">
        <Link
          href={localeHref(locale, "/tools")}
          prefetch={false}
          className="inline-flex items-center text-[14px] font-bold text-brand-600 transition-colors hover:text-brand-700"
        >
          {c.tool_all_tools}
        </Link>
      </div>
    </div>
  );
}
