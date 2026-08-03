"use client";

import { useEffect, useState } from "react";

// Told once, then never again: the district the visitor chose has no doctors
// yet, so every list on the site is quietly showing another district's.
//
// Without this the substitution is invisible — headings say "খুলনার ডাক্তার"
// while the visitor is certain they picked ভোলা, which reads like a bug. It
// is deliberately a corner toast rather than a strip at the top: it explains
// something already working, so it must never push the page down or stand
// between the visitor and the content.
//
// Dismissal is permanent (no expiry) and keyed to the district pair, so a
// visitor who later picks a different empty district is told about that one.
const KEY = "geo_no_doctors_dismissed";

export function NoDoctorsNotice({
  message,
  pairKey,
}: {
  message: string;
  /** `<chosen>|<shown>` — dismissing one pair must not silence the others. */
  pairKey: string;
}) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let dismissed: string[] = [];
    try {
      dismissed = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    } catch {
      // Corrupt or unavailable storage — showing the notice once more is a far
      // better failure than suppressing it forever.
    }
    if (Array.isArray(dismissed) && dismissed.includes(pairKey)) return;
    // Let the page settle first; this is an explanation, not an interruption.
    const t = window.setTimeout(() => setVisible(true), 900);
    return () => window.clearTimeout(t);
  }, [pairKey]);

  if (!visible) return null;

  const dismiss = () => {
    setLeaving(true);
    try {
      const raw = window.localStorage.getItem(KEY);
      const list: unknown = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(list) ? [...new Set([...list, pairKey])] : [pairKey];
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — it still goes away for this view */
    }
    window.setTimeout(() => setVisible(false), 200);
  };

  // A notification, not an error. The amber is reduced to a single left bar
  // against a plain white card: enough to catch the eye and mark the message
  // as "heads up", without the all-over wash that read as something breaking.
  // Body text stays normal ink so it is simply read, not alarmed at.
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-20 left-3 right-3 z-40 mx-auto max-w-[420px] overflow-hidden rounded-xl border border-line border-l-4 border-l-warm bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,.14)] transition-all duration-200 ease-out min-[1060px]:bottom-5 min-[1060px]:left-5 min-[1060px]:right-auto motion-reduce:transition-none ${
        leaving ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <p className="flex-1 text-[12.5px] leading-relaxed text-ink">{message}</p>
        <button
          onClick={dismiss}
          aria-label="বন্ধ করুন"
          className="-mr-1 -mt-1 shrink-0 rounded-full px-1.5 py-0.5 text-[13px] text-ink-ghost transition hover:bg-page hover:text-ink-soft"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
