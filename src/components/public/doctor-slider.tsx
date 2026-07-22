"use client";

import React, { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { DoctorCard } from "@/components/public/doctor-card";
import type { DoctorCardData } from "@/lib/data";
import type { Dict } from "@/lib/dict";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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

type PropType = {
  slides: DoctorCardData[];
  helpline: string;
  locale: Locale;
  d: Pick<Dict, "verified_badge" | "new_profile" | "fee" | "taka" | "details" | "book_appointment" | "call_short" | "years_plus">;
};

export const DoctorSlider: React.FC<PropType> = (props) => {
  const { slides, ...cardProps } = props;
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
          {slides.map((doctor) => (
            <div
              key={doctor.id}
              className="relative shrink-0 basis-full sm:basis-1/2 min-[1000px]:basis-1/4 pl-4"
            >
              <DoctorCard doctor={doctor} {...cardProps} />
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
