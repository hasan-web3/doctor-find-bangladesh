"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { AutoAnimate } from "@/components/auto-animate";
import { fuzzyFilter } from "@/lib/fuzzy";
import { getDict } from "@/lib/dict";
import { localeHref, num, type Locale } from "@/lib/i18n";
import type { Specialty } from "@/lib/data";

const TINTS = [
  { bg: "#F0FDFA", fg: "#0F766E" },
  { bg: "#ECFDF5", fg: "#059669" },
  { bg: "#FFF7ED", fg: "#EA580C" },
  { bg: "#EFF6FF", fg: "#2563EB" },
  { bg: "#FDF4FF", fg: "#A21CAF" },
];

type Props = {
  initialSpecialties: Specialty[];
  locale: Locale;
};

export function SpecialtyListClient({ initialSpecialties, locale }: Props) {
  const [query, setQuery] = useState("");
  const d = getDict(locale);

  const filteredSpecialties = useMemo(
    () => fuzzyFilter(initialSpecialties, query, (s) => [s.name, s.name_ml?.bn, s.name_ml?.en]),
    [initialSpecialties, query]
  );

  return (
    <div>
      {/* Search Bar */}
      <div className="mb-8 max-w-lg">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={d.search_by_specialty || "বিভাগ অনুযায়ী খুঁজুন"}
            className="w-full rounded-full border border-line bg-white py-3 pl-12 pr-4 text-base shadow-lg shadow-brand-500/5 placeholder:text-ink-ghost focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint">
            <Icon name="search" />
          </div>
        </div>
      </div>

      {/* Grid of Specialties */}
      <AutoAnimate
        as="div"
        className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 min-[900px]:grid-cols-4"
      >
        {filteredSpecialties.map((s) => {
          const tint = TINTS[s.tint % TINTS.length];
          return (
            <Link
              key={s.id}
              href={localeHref(locale, `/specialties/${s.slug}`)}
              className="flex h-full items-start gap-3.5 rounded-2xl border border-line bg-white p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-cardhover"
            >
              <span
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px]"
                style={{ background: tint.bg, color: tint.fg }}
              >
                <Icon name={s.icon} />
              </span>
              <span className="flex-1">
                <span className="block break-words text-[15px] font-semibold leading-tight text-ink">
                  {s.name}
                </span>
                {s.doctor_count > 0 && (
                  <span className="mt-0.5 block text-[12.5px] text-ink-ghost">
                    {num(s.doctor_count, locale)} {d.doctors_unit}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </AutoAnimate>
      {filteredSpecialties.length === 0 && (
         <div className="col-span-full py-10 text-center">
            <p className="text-lg text-ink-mute">{d.no_search_results || "No specialties found matching your search."}</p>
         </div>
      )}
    </div>
  );
}
