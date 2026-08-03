"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fuzzyFilter } from "@/lib/fuzzy";
import { num } from "@/lib/i18n";

export type DistrictOption = {
  slug: string;
  /** Bangla name — the only one rendered. */
  name: string;
  /** English name. Never shown; exists so typing "khulna" finds "খুলনা". */
  nameEn: string | null;
  doctorCount: number;
  /** True for the handful the IP hint put closest — used only as a soft cue. */
  nearby?: boolean;
};

// Deliberately Bangla-only, even on the /en side of the site. This prompt is
// the one moment we interrupt someone, and the visitors whose district we get
// wrong are overwhelmingly reading Bangla — a bilingual toggle here would add
// a decision to a screen whose whole job is to ask exactly one question.
const COPY = {
  title: "আপনি কোন জেলা থেকে দেখছেন?",
  sub: "জেলা জানালে আপনার সবচেয়ে কাছের ডাক্তার ও হাসপাতাল আগে দেখানো হবে।",
  search: "জেলা খুঁজুন (বাংলা বা English)",
  empty: "এই নামে কোনো জেলা পাওয়া যায়নি।",
  skip: "পরে জানাব",
  confirm: "নিশ্চিত করুন",
  saving: "সংরক্ষণ হচ্ছে…",
  nearby: "সম্ভাব্য কাছের",
  doctors: "জন ডাক্তার",
};

// Long enough to read as motion, short enough that dismissing never feels
// like waiting. Kept in sync with the duration-200 classes below.
const EXIT_MS = 200;

export function DistrictModal({
  districts,
  onPick,
  onClose,
  pending,
}: {
  districts: DistrictOption[];
  onPick: (slug: string) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  // Drives both the enter and the exit transition. Starts false so the first
  // committed frame is the "closed" one and the browser has something to
  // animate from.
  const [shown, setShown] = useState(false);
  const closingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Flip to the open state one tick after mount so the browser has a closed
  // frame to transition from. Deliberately a timer and not
  // requestAnimationFrame: rAF callbacks never run while the tab is
  // backgrounded or otherwise not compositing, which would leave the modal
  // mounted at opacity 0 — present, focus-trapping and invisible.
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 20);
    return () => window.clearTimeout(t);
  }, []);

  // Play the exit transition first, then actually unmount. Guarded so a
  // double-tap (backdrop + Escape) cannot schedule two unmounts.
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setShown(false);
    window.setTimeout(onClose, EXIT_MS);
  }, [onClose]);

  // Escape closes, and the background must not scroll underneath the sheet on
  // mobile — without the overflow lock the list and the page fight each other.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [requestClose]);

  const filtered = useMemo(
    () => fuzzyFilter(districts, q, (o) => [o.name, o.nameEn]),
    [q, districts]
  );

  // A selection that the current search has filtered out would leave the
  // confirm button referring to something invisible; keep it, but make sure
  // clearing the box brings the row back into view.
  useEffect(() => {
    if (!selected || q) return;
    listRef.current
      ?.querySelector(`[data-slug="${CSS.escape(selected)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [q, selected]);

  const confirm = () => {
    if (selected && !pending) onPick(selected);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-end justify-center p-3 transition-opacity duration-200 ease-out sm:items-center sm:p-5 motion-reduce:transition-none ${
        shown ? "bg-ink/40 opacity-100 backdrop-blur-[2px]" : "bg-ink/0 opacity-0"
      }`}
      onMouseDown={(e) => {
        // Only a click that both starts and ends on the backdrop closes —
        // otherwise a drag that began inside the list dismisses the sheet.
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={COPY.title}
        className={`flex max-h-[85vh] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(15,23,42,.28)] transition-all duration-200 ease-out sm:max-w-[560px] motion-reduce:transition-none ${
          shown ? "translate-y-0 scale-100 opacity-100" : "translate-y-5 scale-[.97] opacity-0"
        }`}
      >
        {/* header */}
        <div className="relative shrink-0 bg-gradient-to-br from-brand-600 to-brand-700 px-5 pb-5 pt-4 text-white">
          <button
            onClick={requestClose}
            aria-label="বন্ধ করুন"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[15px] text-white/80 transition hover:bg-white/15 hover:text-white"
          >
            ✕
          </button>
          <div className="mb-1.5 text-[22px] leading-none">◉</div>
          <h2 className="pr-8 font-heading text-[17px] font-bold leading-snug">{COPY.title}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/85">{COPY.sub}</p>
        </div>

        {/* search */}
        <div className="shrink-0 border-b border-line p-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={COPY.search}
            className="w-full rounded-xl border border-line bg-page px-3.5 py-2.5 text-[14px] text-ink outline-none transition focus:border-brand-500 focus:bg-white"
          />
        </div>

        {/* list */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5">
          {filtered.length > 0 ? (
            filtered.map((o) => {
              const on = selected === o.slug;
              return (
                <button
                  key={o.slug}
                  type="button"
                  data-slug={o.slug}
                  role="radio"
                  aria-checked={on}
                  disabled={pending}
                  onClick={() => setSelected(o.slug)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition disabled:opacity-50 ${
                    on ? "bg-brand-50" : "hover:bg-brand-50/60"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition ${
                      on ? "border-brand-600" : "border-line"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full bg-brand-600 transition-transform duration-150 ${
                        on ? "scale-100" : "scale-0"
                      }`}
                    />
                  </span>
                  <span
                    className={`flex-1 truncate text-[14.5px] ${
                      on ? "font-bold text-brand-700" : "font-semibold text-ink"
                    }`}
                  >
                    {o.name}
                    {o.nearby && !q && (
                      <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">
                        {COPY.nearby}
                      </span>
                    )}
                  </span>
                  {o.doctorCount > 0 && (
                    <span className="shrink-0 text-[11.5px] text-ink-ghost">
                      {num(o.doctorCount, "bn")} {COPY.doctors}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="px-4 py-8 text-center text-[13px] text-ink-faint">{COPY.empty}</div>
          )}
        </div>

        {/* footer — turns into a commit action only once something is picked, so
            the modal never closes out from under a mis-tap. */}
        <div className="shrink-0 border-t border-line px-4 py-3 text-center">
          {selected ? (
            <button
              onClick={confirm}
              disabled={pending}
              className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-[14.5px] font-bold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {pending ? COPY.saving : COPY.confirm}
            </button>
          ) : (
            <button
              onClick={requestClose}
              className="text-[13px] font-semibold text-ink-faint underline underline-offset-2 transition hover:text-ink-soft"
            >
              {COPY.skip}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
