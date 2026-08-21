import Link from "next/link";
import { Icon } from "@/components/icons";
import { getSettings } from "@/lib/settings";
import { getToolCopy, pick } from "@/lib/tools/copy";
import { enabledTools, toolsForSpecialty, type ToolDef } from "@/lib/tools/registry";
import { localeHref, type Locale } from "@/lib/i18n";

/**
 * The cross-link between the directory and the calculators.
 * ---------------------------------------------------------------------------
 * Someone reading the endocrinology hub, or a diabetes specialist's profile, is
 * within one query of "what is my BMI" — and someone who just calculated a high
 * BMI is within one query of "endocrinologist near me". Those are the same
 * visitor at two points in the same journey, and until now the site answered
 * only one half of it.
 *
 * Matching is by specialty slug against the registry (see toolsForSpecialty),
 * so this costs one cached settings read and no database work at all. It
 * renders NOTHING when no tool matches, which is the common case — a strip of
 * vaguely-related links on every page would be link spam, not internal linking.
 *
 * `exclude` lets a tool page reuse this for its "other tools" row without
 * linking to itself.
 */
export async function RelatedTools({
  locale,
  specialtySlugs,
  exclude,
  title,
  subtitle,
  limit = 3,
}: {
  locale: Locale;
  /** Match against these. Omit to show a general selection instead. */
  specialtySlugs?: string[];
  /** Tool keys to leave out (e.g. the page's own tool). */
  exclude?: string[];
  title?: string;
  subtitle?: string;
  limit?: number;
}) {
  const settings = await getSettings();
  const c = getToolCopy(locale);
  const skip = new Set(exclude ?? []);

  let matches: ToolDef[];
  if (specialtySlugs && specialtySlugs.length > 0) {
    const seen = new Set<string>();
    matches = [];
    for (const slug of specialtySlugs) {
      for (const t of toolsForSpecialty(slug, settings.tools_enabled)) {
        if (seen.has(t.key) || skip.has(t.key)) continue;
        seen.add(t.key);
        matches.push(t);
      }
    }
  } else {
    matches = enabledTools(settings.tools_enabled).filter((t) => !skip.has(t.key));
  }

  if (matches.length === 0) return null;
  const shown = matches.slice(0, limit);

  return (
    <section>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="m-0 font-heading text-[19px] font-bold text-ink">{title ?? c.tool_other_tools}</h2>
        <Link
          href={localeHref(locale, "/tools")}
          prefetch={false}
          className="text-[13.5px] font-bold text-brand-600 transition-colors hover:text-brand-700"
        >
          {c.tool_all_tools}
        </Link>
      </div>
      {subtitle && <p className="mb-4 mt-0 text-[13.5px] text-ink-faint">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-4"}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[900px]:grid-cols-3">
          {shown.map((t) => (
            <Link
              key={t.key}
              href={localeHref(locale, `/tools/${t.slug}`)}
              prefetch={false}
              className="group flex items-start gap-3 rounded-xl border border-line bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ background: t.bg, color: t.fg }}
                aria-hidden
              >
                <Icon name={t.icon} size={21} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14.5px] font-bold leading-snug text-ink group-hover:text-brand-700">
                  {pick(t.name, locale)}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-faint">
                  {pick(t.tagline, locale)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
