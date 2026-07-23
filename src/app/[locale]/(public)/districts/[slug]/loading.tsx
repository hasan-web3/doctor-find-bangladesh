import { Shimmer } from "@/components/shimmer";

export default function Loading() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      {/* Breadcrumbs shimmer */}
      <Shimmer className="mb-8 h-5 w-64 rounded-lg" />
      
      {/* Title shimmer */}
      <Shimmer className="mb-2 h-10 w-3/4 rounded-lg" />
      <Shimmer className="mb-8 h-6 w-1/2 rounded-lg" />

      <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[260px_1fr]">
        {/* Filters shimmer */}
        <div>
          <div className="sticky top-[88px]">
            <Shimmer className="h-[600px] w-full rounded-2xl" />
          </div>
        </div>

        {/* Doctor list shimmer */}
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Shimmer className="h-12 flex-1 min-w-[200px] rounded-xl" />
            <Shimmer className="h-12 w-full sm:w-[200px] rounded-xl" />
          </div>
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[1100px]:grid-cols-3 min-[1400px]:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Shimmer key={i} className="h-[360px] w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
