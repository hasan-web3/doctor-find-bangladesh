"use client";

import React, { useCallback } from 'react';
import Image from "next/image";
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Icon } from "@/components/icons";
import { clsx } from 'clsx';

type Slide = { id: number; title: string; text: string; icon: string; image_url: string | null };

const TINTS = [
  { bg: "#F0FDFA", fg: "#0D9488" },
  { bg: "#ECFDF5", fg: "#059669" },
  { bg: "#FFF7ED", fg: "#EA580C" },
];

export function HeroSlider({ slides, verifiedLabel }: { slides: Slide[]; verifiedLabel: string }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' }, [Autoplay({ delay: 5000, stopOnInteraction: false })]);

  const scrollTo = useCallback((index: number) => {
    if (emblaApi) emblaApi.scrollTo(index);
  }, [emblaApi]);

  const [selectedIndex, setSelectedIndex] = React.useState(0);

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);


  if (slides.length === 0) {
    return (
        <div className="relative flex min-h-[340px] items-center justify-center">
            <div className="absolute h-[340px] w-[340px] rounded-full opacity-[.14] blur-[6px] [background:radial-gradient(circle_at_30%_30%,#5EEAD4,#0D9488)]" />
            <div className="relative w-full max-w-[420px]">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(13,148,136,0.18)]">
                    <div className="flex h-full w-full items-center justify-center text-brand-300">
                        <Icon name="user" size={120} />
                    </div>
                </div>
            </div>
        </div>
    )
  }

  return (
    <div className="relative flex min-h-[340px] items-center justify-center">
      <div className="absolute h-[340px] w-[340px] rounded-full opacity-[.14] blur-[6px] [background:radial-gradient(circle_at_30%_30%,#5EEAD4,#0D9488)]" />

      <div className="relative w-full max-w-[420px] overflow-hidden" ref={emblaRef}>
        <div className="flex -ml-4">
          {slides.map((slide, i) => {
            const tint = TINTS[i % TINTS.length];
            return (
              <div key={slide.id} className="relative min-w-0 flex-full pl-4">
                <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(13,148,136,0.18)]">
                  {slide.image_url ? (
                    <Image src={slide.image_url} alt={slide.title || ''} fill priority sizes="(max-width: 900px) 90vw, 420px" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-brand-300">
                      <Icon name="user" size={120} />
                    </div>
                  )}
                </div>
                <div className="absolute left-3.5 top-3.5 flex items-center gap-2 rounded-xl bg-white px-3 py-[7px] text-[12.5px] font-bold text-[#059669] shadow-[0_6px_16px_rgba(15,23,42,.1)]">
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent-soft">✓</span>
                  {verifiedLabel}
                </div>
                <div className="absolute bottom-3.5 left-3.5 right-3.5 min-h-[66px] rounded-[14px] bg-white/95 px-4 py-3.5 shadow-[0_8px_22px_rgba(15,23,42,.14)] backdrop-blur-[6px]">
                  <div className="flex items-center gap-[11px]">
                    <span
                      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]"
                      style={{ background: tint.bg, color: tint.fg }}
                    >
                      <Icon name={slide.icon} size={20} />
                    </span>
                    <div>
                      <div className="font-heading text-base font-bold leading-tight text-ink">{slide.title}</div>
                      <div className="text-[12.5px] leading-snug text-ink-faint">{slide.text}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {slides.length > 1 && (
        <div className="absolute -bottom-[22px] left-1/2 flex -translate-x-1/2 gap-[7px]">
        {slides.map((_, i) => (
            <button
            key={i}
            onClick={() => scrollTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={clsx(
                "flex h-6 min-w-[24px] items-center justify-center rounded-full",
            )}
            >
            <span
                aria-hidden="true"
                className="block h-2 rounded-full transition-all duration-300"
                style={{ width: selectedIndex === i ? 22 : 8, background: selectedIndex === i ? "#0B7F75" : "#CBD5E1" }}
            />
            </button>
        ))}
        </div>
      )}
    </div>
  );
}
