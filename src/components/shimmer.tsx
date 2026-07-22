import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

// Shimmer building blocks for instant loading states (loading.tsx).
export function Shimmer({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-line/60",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.4s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-white/70 after:to-transparent",
        className
      )}
      style={style}
    />
  );
}

export function CardShimmer() {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start gap-3.5">
        <Shimmer className="h-14 w-14 rounded-[14px]" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-4 w-3/4" />
          <Shimmer className="h-3.5 w-1/2" />
        </div>
      </div>
      <Shimmer className="mt-4 h-3 w-full" />
      <Shimmer className="mt-2 h-3 w-2/3" />
      <div className="mt-4 flex gap-2">
        <Shimmer className="h-10 flex-1 rounded-[10px]" />
        <Shimmer className="h-10 flex-1 rounded-[10px]" />
      </div>
    </div>
  );
}

export function PageShimmer() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <Shimmer className="mb-4 h-3.5 w-40" />
      <Shimmer className="mb-2 h-8 w-72 max-w-full" />
      <Shimmer className="mb-8 h-4 w-96 max-w-full" />
      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[900px]:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardShimmer key={i} />
        ))}
      </div>
    </div>
  );
}
