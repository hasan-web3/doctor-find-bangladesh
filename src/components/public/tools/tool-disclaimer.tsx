import { Icon } from "@/components/icons";
import { getToolCopy } from "@/lib/tools/copy";
import type { Locale } from "@/lib/i18n";

/**
 * The medical disclaimer and the privacy statement, on every tools page.
 *
 * Not optional and not collapsible. Under BMDC rules only a registered
 * practitioner may diagnose, so a calculator on a health site has to say
 * plainly that it is not doing that — and the line has to be visible without
 * interaction, not folded into an accordion nobody opens.
 *
 * The privacy half is here for a different reason: it is true, it is unusual,
 * and it is the single most reassuring thing the page can say. Every one of
 * these calculators runs in the visitor's own browser, so the site never
 * receives a weight, a period date, or anything else typed into them.
 *
 * A server component on purpose — it is pure text and must not cost the client
 * bundle anything.
 */
export function ToolDisclaimer({ locale }: { locale: Locale }) {
  const c = getToolCopy(locale);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-warm-border bg-warm-soft px-4 py-3.5">
        <div className="mb-1 flex items-center gap-2 text-[14px] font-bold text-warm-text">
          <Icon name="shield" size={17} />
          {c.tool_disclaimer_title}
        </div>
        <p className="m-0 text-[13.5px] leading-[1.75] text-ink-mute">{c.tool_disclaimer}</p>
      </div>
      <div className="rounded-xl border border-line bg-white px-4 py-3.5">
        <div className="mb-1 flex items-center gap-2 text-[14px] font-bold text-brand-700">
          <Icon name="eye" size={17} />
          {locale === "bn" ? "গোপনীয়তা" : "Privacy"}
        </div>
        <p className="m-0 text-[13.5px] leading-[1.75] text-ink-mute">{c.tool_privacy_note}</p>
      </div>
    </div>
  );
}
