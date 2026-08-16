"use client";

import { useEffect, useState } from "react";
import { num, type Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/dict";
import { BMDC_VERIFY_URL, bmdcExpiry, formatBmdcMonth } from "@/lib/bmdc";

type BmdcDict = Pick<
  Dict,
  | "bmdc_badge"
  | "bmdc_modal_title"
  | "bmdc_modal_intro"
  | "bmdc_reg_no_label"
  | "bmdc_reg_year_label"
  | "bmdc_valid_till_label"
  | "bmdc_how_title"
  | "bmdc_how_1"
  | "bmdc_how_2"
  | "bmdc_how_3"
  | "bmdc_how_4"
  | "bmdc_check_yourself"
  | "bmdc_official_site"
  | "bmdc_disclaimer"
  | "bmdc_expired_note"
  | "close"
>;

// The BMDC badge on a doctor profile, plus the explainer it opens.
//
// A client component, but a tiny one, and it takes everything it renders as
// props. That keeps the profile page itself fully static: the page stays on
// ISR, reads no searchParams and does no per-request work, so the modal costs
// nothing in serverless CPU no matter how many people open it. The badge text
// is in the prerendered HTML too, so a crawler sees the claim without running
// any JavaScript.
export function BmdcBadge({
  regNo,
  regYear,
  validTill,
  locale,
  d,
}: {
  regNo: string;
  regYear: number | null;
  /** ISO yyyy-mm-dd, or null. */
  validTill: string | null;
  locale: Locale;
  d: BmdcDict;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Evaluated on the client, which is what makes it correct on an ISR page: a
  // server-rendered "expired" would be frozen into the cached HTML and go stale
  // the day after it was generated. Here it is judged against the reader's own
  // today, every time they open the modal.
  const expired = bmdcExpiry(validTill) === "expired";

  const steps = [d.bmdc_how_1, d.bmdc_how_2, d.bmdc_how_3, d.bmdc_how_4];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-accent-text/25 bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-text transition-colors hover:bg-accent-text/10"
      >
        {d.bmdc_badge}
        <span aria-hidden className="text-[13px] leading-none opacity-70">ⓘ</span>
      </button>

      {/* ALWAYS in the DOM, hidden with CSS rather than unmounted.
          It used to be `{open && ...}`, which meant everything that justifies
          the badge — the registration number, the validity, the four steps, the
          link to the register — existed only after a human clicked. Googlebot
          runs JavaScript but does not click, so on a YMYL medical page the one
          thing we most want read was the one thing never rendered.
          Hidden-but-present content is ordinary accordion/tab markup and is
          indexed normally.

          Both the `hidden` attribute and the `hidden` CLASS are set: the
          attribute takes it out of the accessibility tree, and the class is
          what actually wins the cascade, because Tailwind's `flex` would
          otherwise override the user-agent rule for [hidden]. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={d.bmdc_modal_title}
        hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-[100] ${open ? "flex" : "hidden"} items-center justify-center bg-black/60 p-4 backdrop-blur-sm`}
      >
          {/* Centred with a margin on every screen size, phones included. It
              used to dock to the bottom edge on mobile (`items-end` + `p-0` +
              square bottom corners), which read as a sheet glued to the frame
              rather than a dialog. `p-4` on the overlay is what holds the gap:
              the panel is `w-full`, so the padding is the only thing between it
              and the screen edge. */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-[560px] overflow-y-auto rounded-[22px] bg-white shadow-[0_20px_50px_rgba(0,0,0,.35)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
              <div>
                <div className="font-heading text-[19px] font-bold text-ink">{d.bmdc_modal_title}</div>
                <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-ink-mute">{d.bmdc_modal_intro}</p>
              </div>
              <button
                type="button"
                aria-label={d.close}
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-full p-1.5 text-xl leading-none text-ink-ghost transition-colors hover:bg-page hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-5 px-6 py-5">
              <dl className="m-0 grid grid-cols-1 gap-3 rounded-2xl bg-page p-4 sm:grid-cols-3">
                <div>
                  <dt className="m-0 text-[12px] font-semibold text-ink-ghost">{d.bmdc_reg_no_label}</dt>
                  {/* font-latin: a registration number is an identifier and has
                      to read identically in both locales, so it never picks up
                      Bangla digit shaping. */}
                  <dd className="m-0 mt-0.5 font-latin text-[15px] font-bold text-ink">{regNo}</dd>
                </div>
                {regYear !== null && (
                  <div>
                    <dt className="m-0 text-[12px] font-semibold text-ink-ghost">{d.bmdc_reg_year_label}</dt>
                    {/* As a STRING, so num() localises the digits without
                        grouping them: a year is an identifier, not a quantity,
                        and en-IN grouping rendered 2015 as "২,০১৫". Same reason
                        date() passes years through as strings. */}
                    <dd className="m-0 mt-0.5 text-[15px] font-bold text-ink">{num(String(regYear), locale)}</dd>
                  </div>
                )}
                {validTill && (
                  <div>
                    <dt className="m-0 text-[12px] font-semibold text-ink-ghost">{d.bmdc_valid_till_label}</dt>
                    {/* mm/yyyy, the way the BMDC register prints it. num() as a
                        STRING localises the digits without regrouping them. */}
                    <dd className={`m-0 mt-0.5 text-[15px] font-bold ${expired ? "text-[#DC2626]" : "text-ink"}`}>
                      {num(formatBmdcMonth(validTill), locale)}
                    </dd>
                  </div>
                )}
              </dl>

              {expired && (
                <p className="m-0 rounded-xl bg-[#FEF2F2] px-4 py-3 text-[13.5px] leading-relaxed text-[#B91C1C]">
                  {d.bmdc_expired_note}
                </p>
              )}

              <div>
                <div className="mb-2 font-heading text-[15px] font-bold text-ink">{d.bmdc_how_title}</div>
                <ol className="m-0 flex list-none flex-col gap-2 p-0">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-mute">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
                        {num(i + 1, locale)}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
                <div className="mb-1.5 text-[13px] font-bold text-ink">{d.bmdc_check_yourself}</div>
                <a
                  href={BMDC_VERIFY_URL}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="break-all font-latin text-[13.5px] font-semibold text-brand-700 underline"
                >
                  {BMDC_VERIFY_URL}
                </a>
                <div className="mt-1 text-[12.5px] text-ink-mute">{d.bmdc_official_site}</div>
              </div>

              <p className="m-0 text-[12.5px] leading-relaxed text-ink-faint">{d.bmdc_disclaimer}</p>
            </div>
        </div>
      </div>
    </>
  );
}
