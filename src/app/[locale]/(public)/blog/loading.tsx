import { Shimmer } from "@/components/shimmer";

function PostCardShimmer() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-white">
      <Shimmer className="relative h-40" />
      <div className="px-5 py-[18px]">
        <Shimmer className="mb-2 h-3 w-2/3" />
        <Shimmer className="mb-2.5 h-5 w-full" />
        <Shimmer className="h-4 w-24" />
      </div>
    </div>
  );
}

export default function BlogLoading() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      {/* Breadcrumbs */}
      <Shimmer className="mb-4 h-3.5 w-40" />
      {/* Title & Subtitle */}
      <Shimmer className="mb-1.5 h-8 w-64 max-w-full" />
      <Shimmer className="mb-5 h-4 w-80 max-w-full" />

      {/* Category Filters */}
      <div className="mb-[26px] flex flex-wrap gap-2">
        <Shimmer className="h-9 w-16 rounded-full" />
        <Shimmer className="h-9 w-24 rounded-full" />
        <Shimmer className="h-9 w-20 rounded-full" />
        <Shimmer className="h-9 w-28 rounded-full" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 min-[900px]:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <PostCardShimmer key={i} />
        ))}
      </div>
    </div>
  );
}
