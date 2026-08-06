"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/dict";

// How long a deliberate touch holds the strip at full opacity.
const FOCUS_MS = 5000;

// Ignore sub-pixel and rubber-band scroll noise; only a real gesture should
// change the strip's state.
const SCROLL_EPSILON = 6;
// Above this the page counts as "at the top", where the strip is always solid.
const TOP_ZONE = 8;
// How far the page must travel in ONE direction before the strip changes state.
//
// This is what stops the strip blinking on a phone. A touch fling is not
// monotonic: momentum and rubber-banding make the scroll position wobble
// backwards for a frame or two on the way up. Switching on the raw per-event
// direction meant every one of those wobbles collapsed the strip and the next
// frame re-opened it — measured at 8 collapse/expand flips inside a single
// upward fling. A mouse wheel moves in big monotonic jumps, which is why it
// only ever showed up in the mobile view. 40px is far more than any wobble and
// far less than a deliberate gesture.
const DIRECTION_THRESHOLD = 40;
// Must match the CSS transition below. The strip is `sticky`, i.e. it holds its
// place in normal flow, so collapsing it moves the rest of the page up by its
// own height (80px on mobile, where the line wraps). That shift can itself
// register as scrolling, so we stop listening while our own animation runs.
const TRANSITION_MS = 300;

type Mode = "full" | "faint" | "collapsed";

// The quieter of the two asks. Shown after the district modal has been
// dismissed without an answer, and only while the location is still a guess.
//
// Two shapes, depending on whether IP geo gave us anything:
//   • a guess to correct  — "আপনি সম্ভবত ঢাকা থেকে দেখছেন…" + পরিবর্তন করুন
//   • nothing at all      — a plain invitation to pick a district
// The second exists because the strip is the visitor's only way back to the
// picker once the modal is dismissed; without it, anyone we cannot geolocate
// (VPN, unknown ISP, local dev) would lose the entrance entirely.
//
// It sticks below the navbar rather than scrolling away, because "change my
// district" has to stay reachable from anywhere on a long listing page. To
// earn that permanent space it gets out of the way on its own: solid at the
// top of the page, collapsed while reading downward, and faint-but-present on
// the way back up until it is actually touched.
//
// Visibility, dismissal and the back-off timers all live in <GeoPrompt>; this
// component owns only the strip and its scroll behaviour.
export function GeoBanner({
  districtName,
  onChange,
  onDismiss,
  d,
}: {
  /** District granularity only. A thana name here would overstate what an IP
   *  lookup can actually tell us, and the visitor can only correct us at
   *  district level anyway. Null when IP geo yielded nothing. */
  districtName: string | null;
  onChange: () => void;
  onDismiss: () => void;
  d: Pick<
    Dict,
    "geo_viewing_tpl" | "geo_change" | "geo_unknown" | "geo_choose_district"
  >;
}) {
  const [mode, setMode] = useState<Mode>("full");
  // Pin height to the sticky navbar so the strip lands directly under it
  // instead of behind it (the navbar sits at a higher z-index).
  const [top, setTop] = useState(0);
  const focusUntil = useRef(0);
  // Mirrors `mode` for the scroll handler, which runs outside React's render
  // cycle and must know the CURRENT mode to tell a real change from a no-op.
  const modeRef = useRef<Mode>("full");
  // While an open/close animation is playing, scrolling is ignored: the strip
  // is in normal flow, so its own collapse moves the page under the reader.
  const lockedUntil = useRef(0);

  const applyMode = useCallback((next: Mode) => {
    if (modeRef.current === next) return;
    modeRef.current = next;
    lockedUntil.current = Date.now() + TRANSITION_MS;
    setMode(next);
  }, []);

  useEffect(() => {
    const measure = () => {
      const nav = document.querySelector<HTMLElement>("[data-sticky-nav]");
      setTop(nav?.offsetHeight ?? 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    let lastY = window.scrollY;
    // Signed distance travelled since the last direction change. Positive is
    // downward. Reset whenever the direction reverses, so only sustained
    // movement one way reaches DIRECTION_THRESHOLD.
    let travel = 0;
    let frame = 0;

    // One read per animation frame instead of one per event: a touch fling
    // fires scroll far faster than the strip can animate, and every extra read
    // was another chance to flip.
    const settle = () => {
      frame = 0;
      const y = window.scrollY;
      const now = Date.now();

      // The top of the page is unambiguous, so it is decided before anything
      // else can swallow it — including the lock below. A fling that reaches
      // the top inside one animation used to leave the strip sitting faint,
      // because the frame carrying y=0 was the one being dropped.
      if (y <= TOP_ZONE) {
        lastY = y;
        travel = 0;
        applyMode("full");
        return;
      }

      // Inside our own animation: re-baseline and drop the frame, so the page
      // shift the animation causes is never mistaken for a gesture.
      if (now < lockedUntil.current) {
        lastY = y;
        travel = 0;
        return;
      }

      const delta = y - lastY;
      lastY = y;
      if (Math.abs(delta) < SCROLL_EPSILON) return;

      // A held focus survives scrolling — the visitor asked to see it.
      if (now < focusUntil.current) return;

      travel = (travel > 0) === (delta > 0) ? travel + delta : delta;
      if (Math.abs(travel) < DIRECTION_THRESHOLD) return;
      applyMode(travel > 0 ? "collapsed" : "faint");
      travel = 0;
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(settle);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [applyMode]);

  // Any deliberate contact makes it fully legible for a few seconds, then it
  // fades back rather than snapping — snapping mid-read is jarring.
  const hold = useCallback(() => {
    focusUntil.current = Date.now() + FOCUS_MS;
    applyMode("full");
    window.setTimeout(() => {
      if (Date.now() >= focusUntil.current) {
        applyMode(window.scrollY <= TOP_ZONE ? "full" : "faint");
      }
    }, FOCUS_MS);
  }, [applyMode]);

  const collapsed = mode === "collapsed";

  return (
    <div
      style={{ top }}
      onMouseEnter={hold}
      onFocusCapture={hold}
      onTouchStart={hold}
      // Only the three properties that actually animate. `transition-all` also
      // covered `top`, which is set from the navbar's measured height and gets
      // re-measured on every resize — and a phone fires resize each time the
      // browser's URL bar slides in or out, which animated the strip's sticky
      // offset for no reason.
      className={`sticky z-40 overflow-hidden border-b border-brand-100 bg-brand-50 transition-[max-height,opacity,transform] duration-300 ease-out motion-reduce:transition-none ${
        collapsed
          ? "max-h-0 -translate-y-1 opacity-0"
          : mode === "faint"
            ? "max-h-20 opacity-60 hover:opacity-100"
            : "max-h-20 opacity-100"
      }`}
      // Collapsed it must not swallow clicks or keyboard focus meant for the
      // page behind it. A real boolean, not the legacy empty-string form —
      // React warns on the latter and treats it as false, which is the exact
      // opposite of what is wanted here.
      aria-hidden={collapsed}
      inert={collapsed}
    >
      <div className="mx-auto flex max-w-site flex-wrap items-center justify-center gap-x-3 gap-y-2 px-5 py-2 text-[13.5px] text-brand-700">
        <span>
          <span className="mr-1">◉</span>
          {districtName ? (
            // Split on the placeholder rather than concatenating two dict
            // fragments: JSX drops the whitespace around a newline, which is
            // what glued "চট্টগ্রাম" to "থেকে". Splitting keeps exactly the
            // spacing each translation was written with — Bangla wants a space
            // before "থেকে", English wants none before its comma.
            (() => {
              const [before, after] = d.geo_viewing_tpl.split("{d}");
              return (
                <>
                  {before}
                  <b>{districtName}</b>
                  {after}
                </>
              );
            })()
          ) : (
            d.geo_unknown
          )}
        </span>
        <button onClick={onChange} className="font-bold underline underline-offset-2">
          {districtName ? d.geo_change : d.geo_choose_district}
        </button>
        <button onClick={onDismiss} aria-label="বন্ধ করুন" className="text-brand-600">
          ✕
        </button>
      </div>
    </div>
  );
}
