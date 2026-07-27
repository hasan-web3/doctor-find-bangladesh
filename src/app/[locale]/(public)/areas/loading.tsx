import { Shimmer } from "@/components/shimmer";

export default function AreasLoading() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <Shimmer className="mb-4 h-3.5 w-56 max-w-full" />
      <Shimmer className="mb-1.5 h-9 w-3/4 max-w-md" />
      <Shimmer className="mb-8 h-4 w-full max-w-2xl" />

      {/* Search bar */}
      <div className="mb-8">
        <Shimmer className="h-14 w-full rounded-full" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 min-[1400px]:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5">
            <Shimmer className="h-[48px] w-[48px] shrink-0 rounded-[14px]" />
            <div className="min-w-0 flex-1">
              <Shimmer className="mb-1.5 h-5 w-3/4" />
              <Shimmer className="h-3.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
