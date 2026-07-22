"use client";

import { useEffect, useRef, useState } from "react";

const BN = "০১২৩৪৫৬৭৮৯";

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
  const [progress, setProgress] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !started.current) {
          started.current = true;
          const start = performance.now();
          const dur = 1500;
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / dur);
            setProgress(1 - Math.pow(1 - p, 3));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
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
