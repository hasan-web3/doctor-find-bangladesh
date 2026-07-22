"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveStaticPage } from "@/actions/admin-pages";
import { Field, Toast, inputCls } from "@/components/admin/ui";
import { RichTextEditor } from "@/components/admin/rich-text";
import { emptyML, cn, type ML } from "@/lib/utils";
import type { StaticPageSlug } from "@/lib/static-pages";

type PageDraft = {
  slug: StaticPageSlug;
  title: ML;
  meta_description: ML;
  content: ML;
  updated_at: string | null;
};

type Lang = "bn" | "en";

// Admin editor with TWO tab strips: outer = page (Privacy / Terms), inner =
// language (বাংলা / English). Both languages share the same draft state and
// submit together, but only one is displayed at a time — long-form legal
// text is much easier to write when the other language isn't pushing the
// editor off-screen.
export function PagesManager({ pages }: { pages: PageDraft[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PageDraft>>(() =>
    Object.fromEntries(
      pages.map((p) => [
        p.slug,
        {
          ...p,
          title: p.title || { ...emptyML },
          meta_description: p.meta_description || { ...emptyML },
          content: p.content || { ...emptyML },
        },
      ])
    )
  );
  const [activeSlug, setActiveSlug] = useState<StaticPageSlug>(pages[0]?.slug ?? ("privacy" as StaticPageSlug));
  const [activeLang, setActiveLang] = useState<Lang>("bn");

  const active = drafts[activeSlug];
  const updateML = (field: "title" | "meta_description" | "content", langValue: string) =>
    setDrafts((prev) => ({
      ...prev,
      [activeSlug]: {
        ...prev[activeSlug],
        [field]: { ...prev[activeSlug][field], [activeLang]: langValue },
      },
    }));

  const submit = () => {
    startTransition(async () => {
      const res = await saveStaticPage({
        slug: active.slug,
        title: active.title,
        meta_description: active.meta_description,
        content: active.content,
      });
      setResult(res);
      if (res.ok) router.refresh();
    });
  };

  const PAGE_LABEL: Record<StaticPageSlug, { bn: string; en: string; publicPath: string }> = {
    privacy: { bn: "গোপনীয়তা নীতি", en: "Privacy Policy", publicPath: "/privacy" },
    terms: { bn: "শর্তাবলি", en: "Terms & Conditions", publicPath: "/terms" },
  };

  // Public path with locale prefix so "view" jumps to the language the admin
  // is currently editing — they see exactly what they just wrote.
  const publicPath =
    activeLang === "en"
      ? `/en${PAGE_LABEL[activeSlug].publicPath}`
      : PAGE_LABEL[activeSlug].publicPath;

  // Small badge that flags whether the OTHER language is empty on this field
  // so admins don't accidentally publish a page with one side blank.
  const otherLang: Lang = activeLang === "bn" ? "en" : "bn";
  const otherEmpty = (v: ML) => !(v[otherLang] || "").trim();

  return (
    <div>
      <Toast result={result} />

      {/* Outer tab strip — pages */}
      <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-line bg-white p-2">
        {pages.map((p) => {
          const isActive = p.slug === activeSlug;
          const label = PAGE_LABEL[p.slug];
          return (
            <button
              key={p.slug}
              onClick={() => setActiveSlug(p.slug)}
              className={cn(
                "flex-1 rounded-xl px-4 py-3 text-left text-sm transition-colors",
                isActive ? "bg-brand-50 font-bold text-brand-700" : "font-medium text-ink-mute hover:bg-brand-50/50"
              )}
            >
              <div className="text-[15px]">{label.bn}</div>
              <div className="mt-0.5 text-[12px] text-ink-ghost">{label.en}</div>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-heading text-lg font-bold text-ink">
              {PAGE_LABEL[activeSlug].bn}{" "}
              <span className="text-sm font-normal text-ink-ghost">/ {PAGE_LABEL[activeSlug].en}</span>
            </div>
            {active.updated_at && (
              <div className="mt-1 text-[12.5px] text-ink-ghost">
                সর্বশেষ হালনাগাদ / Last updated: {new Date(active.updated_at).toLocaleString()}
              </div>
            )}
          </div>
          <Link
            href={publicPath}
            target="_blank"
            className="rounded-[9px] border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-600 hover:bg-brand-50"
          >
            পাবলিক পেজ দেখুন ({activeLang === "bn" ? "বাংলা" : "English"}) →
          </Link>
        </div>

        {/* Inner tab strip — language */}
        <div className="mb-5 inline-flex rounded-xl border border-line bg-page p-1">
          {(["bn", "en"] as const).map((lng) => {
            const isActive = lng === activeLang;
            const empty = !(active.content[lng] || "").trim();
            return (
              <button
                key={lng}
                onClick={() => setActiveLang(lng)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-[13.5px] font-bold transition-colors",
                  isActive ? "bg-white text-brand-700 shadow-sm" : "text-ink-mute hover:text-ink"
                )}
              >
                {lng === "bn" ? "বাংলা" : "English"}
                {empty && (
                  <span
                    title={lng === "bn" ? "বাংলা content খালি" : "English content is empty"}
                    className="rounded-full bg-warm-soft px-1.5 py-0.5 text-[10px] font-bold text-warm-deep"
                  >
                    খালি / empty
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-5">
          <Field
            label={
              activeLang === "bn"
                ? "পেজের শিরোনাম (বাংলা)"
                : "Page title (English)"
            }
          >
            <input
              className={inputCls + (activeLang === "en" ? " font-latin" : "")}
              value={active.title[activeLang]}
              onChange={(e) => updateML("title", e.target.value)}
              placeholder={activeLang === "bn" ? "যেমন: গোপনীয়তা নীতি" : "e.g. Privacy Policy"}
            />
            {otherEmpty(active.title) && (
              <div className="mt-1 text-[12px] text-warm-deep">
                ⚠ {otherLang === "bn" ? "বাংলা" : "English"} title এখনো ফাঁকা — অন্য tab থেকে পূরণ করুন।
              </div>
            )}
          </Field>

          <Field
            label={
              activeLang === "bn"
                ? "মেটা ডেসক্রিপশন — SEO (বাংলা)"
                : "Meta description — SEO (English)"
            }
            hint="সার্চ রেজাল্টে যে সংক্ষিপ্ত লেখা দেখাবে। ১৪০-১৬০ অক্ষরের মধ্যে রাখুন। / Shown in search results — keep 140-160 chars."
          >
            <textarea
              rows={2}
              className={inputCls + " resize-y font-body" + (activeLang === "en" ? " font-latin" : "")}
              value={active.meta_description[activeLang]}
              onChange={(e) => updateML("meta_description", e.target.value)}
            />
            {otherEmpty(active.meta_description) && (
              <div className="mt-1 text-[12px] text-warm-deep">
                ⚠ {otherLang === "bn" ? "বাংলা" : "English"} meta description ফাঁকা।
              </div>
            )}
          </Field>

          <Field
            label={activeLang === "bn" ? "বিষয়বস্তু (বাংলা)" : "Content (English)"}
            hint="Heading, list, link, bold — সব ব্যবহার করে পূর্ণাঙ্গ পেজ সাজান।"
          >
            {/* Key on lang forces a fresh TipTap instance when switching so
                the editor loads the correct language's HTML from scratch
                instead of showing stale state from the other tab. */}
            <RichTextEditor
              key={`${activeSlug}-${activeLang}`}
              value={active.content[activeLang]}
              onChange={(html) => updateML("content", html)}
            />
            {otherEmpty(active.content) && (
              <div className="mt-1 text-[12px] text-warm-deep">
                ⚠ {otherLang === "bn" ? "বাংলা" : "English"} content ফাঁকা — Save করার আগে অন্য tab-এ ভরুন।
              </div>
            )}
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={submit}
            disabled={pending}
            className="rounded-[10px] bg-brand-600 px-6 py-3 text-[14.5px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ (দুই ভাষা একসাথে)"}
          </button>
          <span className="text-[12.5px] text-ink-ghost">
            Save করলে বাংলা ও ইংরেজি — দুটোই একসাথে DB-তে যাবে।
          </span>
        </div>
      </div>
    </div>
  );
}
