"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const BN = "০১২৩৪৫৬৭৮৯";

// useLayoutEffect logs a warning when it runs during SSR, and this component
// server-renders. useEffect is the correct no-op stand-in there.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const DURATION_MS = 1500;

// Animated count-up for the stats bar. Values are numeric with a suffix
// ("+"), labels arrive pre-localized.
export function StatsCounter({
  stats,
  locale,
}: {
  stats: { value: number; suffix: string; label: string }[];
  locale: "bn" | "en";
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Starts at 1 — i.e. the FINAL numbers — not at 0.
  //
  // It used to start at 0, and progress only ever moved inside the browser, so
  // the HTML leaving the server said "০+" for every stat. Everything that reads
  // markup rather than running it — Google, the AI crawlers, a reader with JS
  // off — was being told the site has 0 doctors, 0 specialties and 0 areas,
  // while the real figures sat unused in the props right next to them.
  //
  // So the prerendered HTML now carries the real values, the hydration pass
  // renders the same thing (it must, or React reports a mismatch), and the
  // reset to 0 happens in a LAYOUT effect — before the browser paints — so the
  // visitor never sees the numbers swap out from under them.
  const [progress, setProgress] = useState(1);
  const started = useRef(false);

  useIsomorphicLayoutEffect(() => {
    setProgress(0);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const run = () => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / DURATION_MS);
        setProgress(1 - Math.pow(1 - p, 3));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);

    // Does this environment paint at all?
    //
    // IntersectionObserver only reports in a tab that composites frames. A
    // headless renderer, a prerender pass or a hidden tab can leave it silent
    // indefinitely, which would strand the bar on "০+" — the exact failure this
    // component is being changed to avoid.
    //
    // requestAnimationFrame is gated on the same thing, so it makes a precise
    // probe: if a frame arrives, IO can be trusted and the fallback is called
    // off, leaving the count-up to play whenever the visitor scrolls down —
    // even minutes later. If no frame arrives, nothing here will ever animate,
    // so show the finished numbers and mark the animation done so a later
    // scroll cannot rewind them to zero.
    //
    // A plain timeout without the probe would misfire on the common case of a
    // visitor who simply takes their time getting to the stats bar.
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const probe = requestAnimationFrame(() => clearTimeout(fallback));
    fallback = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      setProgress(1);
    }, 2000);

    return () => {
      io.disconnect();
      cancelAnimationFrame(probe);
      clearTimeout(fallback);
    };
  }, []);

  const display = (value: number, suffix: string) => {
    const current = Math.round(value * progress).toLocaleString("en-IN");
    const localized = locale === "bn" ? current.replace(/[0-9]/g, (d) => BN[+d]) : current;
    return localized + suffix;
  };

  return (
    <div ref={ref} className="mx-auto grid max-w-site grid-cols-2 gap-[18px] px-5 py-[26px] sm:grid-cols-4">
      {stats.map((s, i) => (
        <div key={i} className="text-center text-white">
          <div className="font-heading text-[clamp(26px,4vw,36px)] font-extrabold leading-none">
            {display(s.value, s.suffix)}
          </div>
          <div className="mt-[5px] text-sm text-brand-200">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
