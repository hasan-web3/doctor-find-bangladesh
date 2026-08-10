import { FaqAccordion } from "@/components/public/faq-accordion";

// A titled FAQ section for the hub pages (district, and anywhere else that
// needs the same block).
//
// This used to render every answer permanently expanded, on the belief that
// Google discounts collapsed content. That belief is out of date: since
// mobile-first indexing, content behind an accordion carries full weight as
// long as it is present in the server HTML, which <FaqAccordion> guarantees.
// See the note at the top of that file.
//
// So the block now uses the same accordion as the homepage. One interaction
// pattern across the site, a much shorter page, and no SEO cost.
export function FaqBlock({
  title,
  faqs,
  className = "",
}: {
  title: string;
  faqs: { id: number; question: string; answer: string }[];
  className?: string;
}) {
  if (faqs.length === 0) return null;

  return (
    <section className={`mt-4 rounded-2xl border border-line bg-white p-5 sm:p-6 ${className}`}>
      <h2 className="mb-4 mt-0 font-heading text-[19px] font-bold text-ink sm:text-[22px]">{title}</h2>
      <FaqAccordion faqs={faqs} headingLevel="h3" />
    </section>
  );
}
