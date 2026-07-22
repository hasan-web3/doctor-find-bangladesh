"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";

type GalleryItem = { key: string; url: string };

/**
 * A responsive, dynamic gallery for hospital images.
 * It renders a carousel, but the navigation controls (arrows, dots)
 * only appear if the content is wide enough to scroll, providing a clean
 * grid-like appearance for fewer images.
 */
export function HospitalGallery({
  items,
  alt,
  closeLabel,
}: {
  items: GalleryItem[];
  alt: string;
  closeLabel: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    // Also re-check on resize for responsive adjustments
    emblaApi.on("resize", onSelect);
  }, [emblaApi, onSelect]);

  // Lightbox: lock scroll + close on Esc/arrows.
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? null : (i + 1) % items.length));
      if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? null : (i - 1 + items.length) % items.length));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox, items.length]);

  if (items.length === 0) return null;

  const showControls = canScrollPrev || canScrollNext;

  return (
    <>
      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex space-x-3">
            {items.map((g, i) => (
              <div key={g.key} className="shrink-0 basis-36">
                <button
                  type="button"
                  onClick={() => setLightbox(i)}
                  aria-label={`${alt} — image ${i + 1}`}
                  className="group relative h-36 w-36 cursor-zoom-in overflow-hidden rounded-xl border border-line bg-brand-50 transition-shadow duration-300 hover:shadow-md"
                >
                  <Image
                    src={g.url}
                    alt={alt}
                    fill
                    sizes="144px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    priority={i < 4}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {showControls && (
          <>
            <button
              type="button"
              onClick={scrollPrev}
              aria-label="Previous image"
              className="absolute left-0 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-ink shadow-card backdrop-blur transition-transform hover:scale-105 disabled:opacity-0"
              disabled={!canScrollPrev}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={scrollNext}
              aria-label="Next image"
              className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-ink shadow-card backdrop-blur transition-transform hover:scale-105 disabled:opacity-0"
              disabled={!canScrollNext}
            >
              ›
            </button>
            <div className="absolute bottom-[-24px] left-1/2 flex -translate-x-1/2 gap-1.5">
              {emblaApi?.scrollSnapList().map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollTo(i)}
                  aria-label={`Go to image ${i + 1}`}
                  className="flex h-6 min-w-[24px] items-center justify-center rounded-full"
                >
                  <span
                    aria-hidden="true"
                    className={`block h-2 rounded-full shadow-sm transition-all duration-300 ${
                      i === selectedIndex ? "w-5 bg-brand-600" : "w-2 bg-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {lightbox !== null && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => setLightbox(null)}
            className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white transition-colors hover:bg-white/25"
          >
            ✕
          </button>
          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i === null ? null : (i - 1 + items.length) % items.length)); }}
                aria-label="Previous"
                className="absolute left-5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightbox((i) => (i === null ? null : (i + 1) % items.length)); }}
                aria-label="Next"
                className="absolute right-5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
              >
                ›
              </button>
            </>
          )}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[90vh] w-full max-w-[1100px] items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={items[lightbox].url}
              alt={alt}
              className="max-h-[90vh] w-auto max-w-full rounded-2xl object-contain shadow-[0_20px_50px_rgba(0,0,0,.5)]"
            />
          </div>
        </div>
      )}
    </>
  );
}
