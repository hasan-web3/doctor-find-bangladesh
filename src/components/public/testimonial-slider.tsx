"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Testimonial = { id: number; name: string; area_text: string; quote: string; photo_url: string | null };

const TONES = [
  { bg: "#F0FDFA", fg: "#0F766E" },
  { bg: "#FFF7ED", fg: "#EA580C" },
  { bg: "#ECFDF5", fg: "#059669" },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("");
}

export function TestimonialSlider({ items }: { items: Testimonial[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => setActive((a) => (a + 1) % items.length), 6000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <>
      <div className="relative min-h-[230px]">
        {items.map((item, i) => {
          const tone = TONES[i % TONES.length];
          return (
            <div
              key={item.id}
              className="flex flex-col items-center transition-opacity duration-[600ms]"
              style={{ position: i === 0 ? "relative" : "absolute", inset: i === 0 ? undefined : 0, opacity: active === i ? 1 : 0 }}
            >
              <div className="max-w-[640px] rounded-[20px] border border-line bg-white px-[30px] py-[34px] shadow-pop">
                <div className="mb-3 text-lg tracking-[2px] text-[#FBBF24]">★★★★★</div>
                <p className="mb-[22px] text-lg italic leading-[1.7] text-ink-soft">{item.quote}</p>
                <div className="flex items-center justify-center gap-3">
                  <div
                    className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-full"
                    style={{ background: tone.bg }}
                  >
                    {item.photo_url ? (
                      <Image src={item.photo_url} alt={item.name} fill sizes="46px" className="object-cover" />
                    ) : (
                      <span className="font-heading font-semibold" style={{ color: tone.fg }}>{initials(item.name)}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-bold text-ink">{item.name}</div>
                    <div className="text-[13px] text-ink-faint">{item.area_text}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {items.length > 1 && (
        <div className="mt-[22px] flex justify-center gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`${i + 1}`}
              className="flex h-6 min-w-[24px] items-center justify-center rounded-full"
            >
              <span
                aria-hidden="true"
                className="block h-2 rounded-full transition-all duration-300"
                style={{ width: active === i ? 22 : 8, background: active === i ? "#0B7F75" : "#CBD5E1" }}
              />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
