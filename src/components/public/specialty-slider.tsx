"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { Specialty } from "@/lib/data";
import type { Dict } from "@/lib/dict";
import { num, type Locale } from "@/lib/i18n";
import { Icon } from "@/components/icons";
import { localeHref } from "@/lib/i18n";

const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const TINTS = [
  { bg: "#F0FDFA", fg: "#0F766E" },
  { bg: "#ECFDF5", fg: "#059669" },
  { bg: "#FFF7ED", fg: "#EA580C" },
  { bg: "#EFF6FF", fg: "#2563EB" },
  { bg: "#FDF4FF", fg: "#A21CAF" },
];

// Replicates the exact horizontal design of cards on the main specialties page
function SpecialtyCard({ specialty, locale, d }: { specialty: Specialty; locale: Locale; d: Dict }) {
  const tint = TINTS[specialty.tint % TINTS.length];

  return (
    <Link
      href={localeHref(locale, `/specialties/${specialty.slug}`)}
      className="flex items-center gap-3.5 rounded-2xl border border-line bg-white p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-cardhover"
    >
      <span
        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px]"
        style={{ background: tint.bg, color: tint.fg }}
      >
        <Icon name={specialty.icon} />
      </span>
      <span>
        <span className="block text-[15px] font-semibold leading-tight text-ink">{specialty.name}</span>
        {specialty.doctor_count > 0 && (
          <span className="mt-0.5 block text-[12.5px] text-ink-ghost">
            {num(specialty.doctor_count, locale)} {d.doctors_unit}
          </span>
        )}
      </span>
    </Link>
  );
}

type PropType = {
  slides: Specialty[];
  locale: Locale;
  d: Dict;
};

export const SpecialtySlider: React.FC<PropType> = (props) => {
  const { slides, locale, d } = props;
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start" },
    [Autoplay({ delay: 5000, stopOnInteraction: true })]
  );

  const [prevBtnDisabled, setPrevBtnDisabled] = useState(true);
  const [nextBtnDisabled, setNextBtnDisabled] = useState(true);

  const scrollPrev = useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setPrevBtnDisabled(!emblaApi.canScrollPrev());
    setNextBtnDisabled(!emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((specialty) => (
            <div
              key={specialty.id}
              className="relative shrink-0 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4 pl-4"
            >
              <SpecialtyCard specialty={specialty} locale={locale} d={d} />
            </div>
          ))}
        </div>
      </div>
      
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between px-2 pointer-events-none">
        <button
          onClick={scrollPrev}
          className="w-10 h-10 rounded-full bg-white/80 shadow-md backdrop-blur-sm flex items-center justify-center text-ink-mute hover:text-ink pointer-events-auto disabled:opacity-0 transition-opacity"
          disabled={prevBtnDisabled}
        >
          <ChevronLeft />
        </button>
        <button
          onClick={scrollNext}
          className="w-10 h-10 rounded-full bg-white/80 shadow-md backdrop-blur-sm flex items-center justify-center text-ink-mute hover:text-ink pointer-events-auto disabled:opacity-0 transition-opacity"
          disabled={nextBtnDisabled}
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
};
