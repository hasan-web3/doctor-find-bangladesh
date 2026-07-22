import { Shimmer, CardShimmer } from "@/components/shimmer";

function FiltersShimmer() {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mb-5">
          <Shimmer className="mb-3 h-5 w-32" />
          <div className="space-y-2.5">
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-5/6" />
            <Shimmer className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DoctorsLoading() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      {/* Breadcrumbs */}
      <Shimmer className="mb-4 h-3.5 w-40" />
      {/* Title and Subtitle */}
      <Shimmer className="mb-1.5 h-8 w-72 max-w-full" />
      <Shimmer className="mb-8 h-4 w-96 max-w-full" />

      <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[260px_1fr]">
        {/* Filters Sidebar */}
        <FiltersShimmer />

        {/* Main Content */}
        <div>
          {/* Search and Sort */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Shimmer className="h-11 flex-grow rounded-lg" />
            <Shimmer className="h-11 w-40 rounded-lg" />
          </div>

          {/* Doctor Card Grid */}
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[900px]:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <CardShimmer key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
