"use client";

import { useState } from "react";

type Faq = { id: number; question: string; answer: string };

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.id} className="overflow-hidden rounded-[14px] border border-line bg-white">
            <button
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="flex w-full items-center justify-between gap-3.5 px-5 py-[18px] text-right"
              aria-expanded={isOpen}
            >
              <span className="text-base font-semibold text-ink">{f.question}</span>
              <span
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-brand-50 text-base text-brand-600 transition-transform duration-300"
                style={{ transform: isOpen ? "rotate(45deg)" : "none" }}
              >
                +
              </span>
            </button>
            <div
              className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
              style={{ maxHeight: isOpen ? 300 : 0 }}
            >
              <p className="m-0 px-5 pb-[18px] text-[15px] leading-relaxed text-ink-mute">{f.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
