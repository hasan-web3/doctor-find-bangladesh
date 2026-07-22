import { Shimmer } from "@/components/shimmer";

function SpecialtyCardShimmer() {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-white p-4">
      <Shimmer className="h-[52px] w-[52px] shrink-0 rounded-[14px]" />
      <div className="w-full">
        <Shimmer className="mb-1 h-5 w-3/4" />
        <Shimmer className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export default function SpecialtiesLoading() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      {/* Breadcrumbs */}
      <Shimmer className="mb-4 h-3.5 w-40" />
      {/* Title & Subtitle */}
      <Shimmer className="mb-1.5 h-8 w-64 max-w-full" />
      <Shimmer className="mb-[26px] h-4 w-80 max-w-full" />

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 min-[900px]:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <SpecialtyCardShimmer key={i} />
        ))}
      </div>
    </div>
  );
}
