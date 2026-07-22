import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { sanitizeHtml } from "@/lib/sanitize";
import { getDict } from "@/lib/dict";
import { date as fmtDate, type Locale } from "@/lib/i18n";
import type { LocalizedStaticPage } from "@/lib/static-pages";

// Presentational shell for Privacy / Terms / any future long-form static
// content. Keeps typography tight (~65ch column), leans on the `.prose-bn`
// class the blog post detail already uses so bilingual headings, lists and
// links render consistently across the site.
export function StaticPageView({
  page,
  locale,
  breadcrumbLabel,
  maxWidthClass = "max-w-[820px]",
}: {
  page: LocalizedStaticPage;
  locale: Locale;
  // Label for the last crumb — defaults to the page title if omitted.
  breadcrumbLabel?: string;
  maxWidthClass?: string;
}) {
  const d = getDict(locale);
  return (
    <div className={`mx-auto px-5 pb-[80px] pt-[26px] ${maxWidthClass}`}>
      <Breadcrumbs
        locale={locale}
        items={[
          { name: d.breadcrumb_home, path: "/" },
          { name: breadcrumbLabel ?? page.title },
        ]}
      />

      <header className="mb-8 rounded-3xl border border-line bg-gradient-to-br from-brand-50 to-white p-8 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
        <h1 className="mb-2 font-heading text-[clamp(28px,4.5vw,40px)] font-bold leading-tight text-ink">
          {page.title}
        </h1>
        {page.meta_description && (
          <p className="m-0 max-w-[560px] text-[15.5px] leading-relaxed text-ink-mute">
            {page.meta_description}
          </p>
        )}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3 py-1 text-[12.5px] font-semibold text-brand-700">
          <span aria-hidden>🕒</span>
          {locale === "bn" ? "সর্বশেষ হালনাগাদ" : "Last updated"}: {fmtDate(page.updated_at, locale)}
        </div>
      </header>

      <article
        className="prose-bn rounded-3xl border border-line bg-white p-8 text-[15.5px] leading-[1.85] text-ink-soft [&_a]:text-brand-700 [&_a]:underline [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:text-ink [&_h2:first-child]:mt-0 [&_li]:mb-1.5 [&_p]:my-3 [&_strong]:text-ink [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
      />
    </div>
  );
}
