"use client";

import { useEffect, useId, useRef, useState } from "react";

type Faq = { id: number; question: string; answer: string };

// ---------------------------------------------------------------------------
// WHY AN ACCORDION IS SAFE HERE.
//
// The old advice that Google discounts collapsed content is desktop-era and no
// longer true: since mobile-first indexing, content behind an accordion or tab
// is indexed and weighted exactly like visible content. Google's own FAQPage
// rich-result documentation shows accordions as the expected pattern.
//
// The condition is what matters, and this component meets it: every answer is
// rendered into the SERVER HTML and only collapsed with CSS. Nothing is fetched
// on click. (Verified against a production build: the raw HTML of a page using
// this component contains the text of all six answers, five of which are
// collapsed on screen.)
//
// What would NOT be safe is loading an answer over the network when the row is
// clicked. If this ever grows a lazy-loading branch, that guarantee is gone.
// ---------------------------------------------------------------------------

export function FaqAccordion({
  faqs,
  /**
   * `h3` when the block already sits under its own `h2` (the district page and
   * the homepage section); `h4` if it is ever nested deeper. Keeping the
   * question inside a real heading preserves the document outline, which the
   * previous bare <button> threw away.
   */
  headingLevel = "h3",
}: {
  faqs: Faq[];
  headingLevel?: "h3" | "h4";
}) {
  const [open, setOpen] = useState(0);
  const baseId = useId();

  return (
    <div className="flex flex-col gap-3">
      {faqs.map((f, i) => (
        <FaqItem
          key={f.id}
          faq={f}
          isOpen={open === i}
          onToggle={() => setOpen(open === i ? -1 : i)}
          buttonId={`${baseId}-b-${f.id}`}
          panelId={`${baseId}-p-${f.id}`}
          headingLevel={headingLevel}
        />
      ))}
    </div>
  );
}

function FaqItem({
  faq,
  isOpen,
  onToggle,
  buttonId,
  panelId,
  headingLevel,
}: {
  faq: Faq;
  isOpen: boolean;
  onToggle: () => void;
  buttonId: string;
  panelId: string;
  headingLevel: "h3" | "h4";
}) {
  const Heading = headingLevel;
  const inner = useRef<HTMLDivElement>(null);
  // The answer's real rendered height, so the panel animates to exactly its
  // content and can never clip it.
  //
  // This replaces a fixed `max-height: 300px`, which silently cut off any
  // answer taller than that — and the longer answers are the useful ones. The
  // `grid-template-rows: 0fr -> 1fr` technique would also work; measuring is
  // used instead because the end state is an explicit pixel value that does not
  // depend on how the browser interpolates fr units.
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setHeight(el.scrollHeight);
    measure();
    // Text reflows when the viewport changes, so a fixed measurement taken once
    // would be wrong at the next breakpoint.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Before the first measurement (server render and the first client paint)
  // an open panel gets no max-height at all, so it renders at its natural
  // height instead of flashing closed and popping open after hydration.
  const maxHeight = isOpen ? (height === null ? undefined : height) : 0;

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-white">
      <Heading className="m-0 text-base font-semibold">
        <button
          id={buttonId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-3.5 px-5 py-[18px] text-left"
          aria-expanded={isOpen}
          aria-controls={panelId}
        >
          <span className="text-base font-semibold text-ink">{faq.question}</span>
          <span
            aria-hidden
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-brand-50 text-base text-brand-600 transition-transform duration-300"
            style={{ transform: isOpen ? "rotate(45deg)" : "none" }}
          >
            +
          </span>
        </button>
      </Heading>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight }}
      >
        <div ref={inner}>
          <p className="m-0 px-5 pb-[18px] text-[15px] leading-relaxed text-ink-mute">{faq.answer}</p>
        </div>
      </div>
    </div>
  );
}
