// A plain, always-expanded FAQ list.
//
// Deliberately NOT an accordion: the answers are the page's supporting content,
// so they stay in the rendered HTML as visible text. A collapsed accordion is
// still crawlable, but Google discounts content it judges hidden by default,
// and this block exists precisely to give the hub pages substance.
//
// Matches the card styling already used by the specialty and thana FAQ
// sections, so the district page looks like the rest of the site.
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
      <div className="flex flex-col gap-3">
        {faqs.map((f) => (
          <div key={f.id} className="rounded-[14px] border border-line px-5 py-[18px]">
            <h3 className="mb-[7px] mt-0 text-base font-semibold text-ink">{f.question}</h3>
            <p className="m-0 text-[14.5px] leading-relaxed text-ink-mute">{f.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
