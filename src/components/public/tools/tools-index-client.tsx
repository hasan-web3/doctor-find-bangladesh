"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { getToolCopy } from "@/lib/tools/copy";
import { localeHref, num, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// The flattened, already-localized projection the server hands down. Deliberately
// NOT the ToolDef itself: passing the registry across the RSC boundary would
// serialise both languages of every string into the HTML payload for a list the
// visitor reads in one language.
export type ToolCardData = {
  key: string;
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  bg: string;
  fg: string;
  category: string;
  categoryLabel: string;
  /** Lowercased match text: name + tagline + keywords, BOTH languages. */
  haystack: string;
};

export function ToolsIndexClient({
  locale,
  tools,
  planned,
}: {
  locale: Locale;
  tools: ToolCardData[];
  planned: ToolCardData[];
}) {
  const c = getToolCopy(locale);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  // One chip per category that actually has a live tool, in the order the
  // registry's sort put them — no hard-coded category list to drift.
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of tools) if (!seen.has(t.category)) seen.set(t.category, t.categoryLabel);
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [tools]);

  const filtered = useMemo(() => {
    // Search matches BOTH languages on purpose: a Bangla-locale visitor who
    // types "bmi" on a Latin keyboard is the common case, not the exception.
    const needle = q.trim().toLowerCase();
    return tools.filter(
      (t) => (cat === "all" || t.category === cat) && (!needle || t.haystack.includes(needle)),
    );
  }, [tools, q, cat]);

  return (
    <div>
      {/* controls */}
      <div className="mb-6 flex flex-col gap-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-ghost">
            <Icon name="search" size={19} />
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={c.index_search_placeholder}
            aria-label={c.index_search_label}
            className="w-full rounded-xl border border-line bg-white py-[13px] pl-[46px] pr-4 text-[15.5px] text-ink outline-none transition-colors focus:border-brand-600 focus:ring-4 focus:ring-brand-50"
          />
        </div>

        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {[{ value: "all", label: c.index_title }, ...categories].map((o) => {
              const active = o.value === cat;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setCat(o.value)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
                    active
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-line bg-white text-ink-mute hover:border-brand-300 hover:text-brand-700",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        )}

        <div aria-live="polite" className="text-[13px] font-semibold text-ink-faint">
          {num(filtered.length, locale)} {c.index_count_one}
        </div>
      </div>

      {/* grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
          <p className="m-0 text-[15px] font-semibold text-ink-soft">{c.index_empty}</p>
          <p className="mb-0 mt-1 text-[13.5px] text-ink-faint">{c.index_empty_hint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1000px]:grid-cols-3">
          {filtered.map((t) => (
            <Link
              key={t.key}
              href={localeHref(locale, `/tools/${t.slug}`)}
              prefetch={false}
              className="group flex flex-col rounded-2xl border border-line bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-cardhover"
            >
              <span
                className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                style={{ background: t.bg, color: t.fg }}
                aria-hidden
              >
                <Icon name={t.icon} size={25} />
              </span>
              <span className="font-heading text-[16.5px] font-bold leading-snug text-ink group-hover:text-brand-700">
                {t.name}
              </span>
              <span className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-ink-mute">{t.tagline}</span>
              <span className="mt-3.5 inline-flex items-center text-[13px] font-bold text-brand-600">
                {c.index_open}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* planned — visible so visitors (and Google) can see the section is
          growing, but not linked: these routes do not exist yet. */}
      {planned.length > 0 && q.trim() === "" && cat === "all" && (
        <div className="mt-11">
          <h2 className="mb-1 mt-0 font-heading text-[19px] font-bold text-ink">{c.index_planned_title}</h2>
          <p className="mb-4 mt-0 text-[13.5px] text-ink-faint">{c.index_planned_sub}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1000px]:grid-cols-3">
            {planned.map((t) => (
              <div
                key={t.key}
                className="flex flex-col rounded-2xl border border-dashed border-line bg-white/60 p-5"
              >
                <span
                  className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl opacity-60"
                  style={{ background: t.bg, color: t.fg }}
                  aria-hidden
                >
                  <Icon name={t.icon} size={25} />
                </span>
                <span className="font-heading text-[16.5px] font-bold leading-snug text-ink-mute">{t.name}</span>
                <span className="mt-1.5 text-[13.5px] leading-relaxed text-ink-faint">{t.tagline}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
