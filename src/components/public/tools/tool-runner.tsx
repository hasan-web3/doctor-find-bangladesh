"use client";

// ---------------------------------------------------------------------------
// Picks the calculator for a tool key.
// ---------------------------------------------------------------------------
// /tools/[slug] is ONE route file, so whatever this module imports statically
// lands in that route's client bundle — meaning a visitor opening the BMI page
// would download the pregnancy calculator too, and every tool added later would
// make every existing tool page heavier.
//
// next/dynamic splits each one into its own chunk instead. SSR stays ON (no
// `ssr: false`), so the server still renders each calculator's empty state into
// the HTML: the page is complete and styled before any of this JavaScript
// arrives, and there is no layout shift when it does.
//
// The `loading` fallback is sized to match the real component's first paint for
// the same reason.
// ---------------------------------------------------------------------------

import dynamic from "next/dynamic";
import type { Locale } from "@/lib/i18n";

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="h-[420px] rounded-2xl border border-line bg-white shadow-card" />
      <div className="min-h-[260px] rounded-2xl border border-dashed border-line bg-white/60" />
    </div>
  );
}

const REGISTRY = {
  bmi: dynamic(() => import("./bmi-tool").then((m) => m.BmiTool), { loading: Skeleton }),
  calorie: dynamic(() => import("./calorie-tool").then((m) => m.CalorieTool), { loading: Skeleton }),
  "due-date": dynamic(() => import("./due-date-tool").then((m) => m.DueDateTool), { loading: Skeleton }),
} as const;

export type RunnableToolKey = keyof typeof REGISTRY;

export function isRunnable(key: string): key is RunnableToolKey {
  return key in REGISTRY;
}

export function ToolRunner({ toolKey, locale }: { toolKey: string; locale: Locale }) {
  if (!isRunnable(toolKey)) return null;
  const Widget = REGISTRY[toolKey];
  return <Widget locale={locale} />;
}
