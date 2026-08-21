import { Shimmer } from "@/components/shimmer";

// Covers /tools and /tools/[slug] alike — a nested segment inherits the nearest
// loading.tsx, and both pages open with the same breadcrumb + heading + card
// rhythm, so one skeleton is honest for both.
export default function ToolsLoading() {
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8">
      <Shimmer className="mb-4 h-3.5 w-44" />
      <Shimmer className="mb-2.5 h-9 w-72 max-w-full" />
      <Shimmer className="mb-7 h-4 w-full max-w-[560px]" />

      <Shimmer className="mb-3 h-[50px] w-full rounded-xl" />
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Shimmer key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1000px]:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-white p-5">
            <Shimmer className="mb-3.5 h-12 w-12 rounded-xl" />
            <Shimmer className="mb-2 h-5 w-3/4" />
            <Shimmer className="h-3.5 w-full" />
            <Shimmer className="mt-1.5 h-3.5 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
