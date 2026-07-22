import { Shimmer } from "@/components/shimmer";

function ProseShimmer() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="mb-6 space-y-2.5">
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-5/6" />
          <Shimmer className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export default function ArticleLoading() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      {/* Breadcrumbs */}
      <Shimmer className="mb-4 h-4 w-full max-w-md" />
      {/* Meta */}
      <Shimmer className="mb-2.5 h-4 w-40" />
      {/* Title */}
      <Shimmer className="mb-5 h-8 w-full max-w-lg" />
      <Shimmer className="mb-5 h-8 w-full max-w-sm" />

      {/* Cover Image */}
      <Shimmer className="relative mb-[26px] h-[320px] sm:h-[400px] md:h-[480px] rounded-[18px]" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <ProseShimmer />
        </div>
        <div className="space-y-6 lg:col-span-4">
          <Shimmer className="h-24 rounded-2xl" />
          <Shimmer className="h-32 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
