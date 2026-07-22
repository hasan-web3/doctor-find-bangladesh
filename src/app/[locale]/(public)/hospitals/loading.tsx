import { Shimmer } from "@/components/shimmer";

function HospitalCardShimmer() {
  return (
    <div className="rounded-[18px] border border-line bg-white p-[22px]">
      <Shimmer className="relative mb-3.5 h-[150px] w-full rounded-[14px]" />
      <Shimmer className="mb-2 h-6 w-3/4" />
      <Shimmer className="mb-3.5 h-4 w-1/2" />
      <div className="mb-4 flex gap-4 border-t border-line pt-3.5">
        <Shimmer className="h-4 w-20" />
        <Shimmer className="h-4 w-20" />
      </div>
      <div className="flex gap-2">
        <Shimmer className="h-12 flex-1 rounded-[10px]" />
        <Shimmer className="h-12 w-20 rounded-[10px]" />
      </div>
    </div>
  );
}

export default function HospitalsLoading() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      {/* Breadcrumbs */}
      <Shimmer className="mb-4 h-3.5 w-40" />
      {/* Title & Subtitle */}
      <Shimmer className="mb-1.5 h-8 w-72 max-w-full" />
      <Shimmer className="mb-[26px] h-4 w-96 max-w-full" />

      {/* Grid */}
      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <HospitalCardShimmer key={i} />
        ))}
      </div>
    </div>
  );
}
