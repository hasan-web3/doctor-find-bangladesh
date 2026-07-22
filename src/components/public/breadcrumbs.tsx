import Link from "next/link";
import { Fragment } from "react";
import { JsonLd } from "@/components/json-ld";
import { ldBreadcrumb } from "@/lib/seo-utils";
import { localeHref, type Locale } from "@/lib/i18n";

export function Breadcrumbs({
  items,
  locale,
}: {
  items: { name: string; path?: string }[];
  locale: Locale;
}) {
  return (
    <>
      <JsonLd data={ldBreadcrumb(items.map((i) => ({ name: i.name, path: i.path || "" })), locale)} />
      <div className="mb-[18px] flex flex-wrap items-center gap-2 text-[13.5px] text-ink-faint">
        {items.map((item, i) => (
          <Fragment key={i}>
            {i > 0 && <span>/</span>}
            {item.path && i < items.length - 1 ? (
              <Link href={localeHref(locale, item.path)} className="text-brand-600 hover:text-brand-700">
                {item.name}
              </Link>
            ) : (
              <span className="text-ink-soft">{item.name}</span>
            )}
          </Fragment>
        ))}
      </div>
    </>
  );
}
