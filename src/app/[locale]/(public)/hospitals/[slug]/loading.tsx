import { Shimmer, CardShimmer } from "@/components/shimmer";

export default function HospitalLoading() {
  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-[60px] pt-[26px]">
      {/* Breadcrumbs */}
      <Shimmer className="mb-6 h-4 w-96 max-w-full" />

      {/* Header */}
      <div className="mb-6 overflow-hidden rounded-[20px] border border-line bg-white">
        <Shimmer className="h-[220px] w-full sm:h-[280px]" />
        <div className="p-[26px]">
          <Shimmer className="mb-2 h-8 w-3/4" />
          <Shimmer className="mb-3 h-5 w-1/2" />
          <div className="max-w-[760px] space-y-2.5">
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-5/6" />
          </div>
        </div>
      </div>

      {/* Departments */}
      <div className="mb-8">
        <Shimmer className="mb-3.5 h-6 w-40" />
        <div className="flex flex-wrap gap-[9px]">
          {Array.from({ length: 5 }).map((_, i) => (
            <Shimmer key={i} className="h-9 w-28 rounded-full" />
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="mb-8">
        <Shimmer className="mb-3.5 h-6 w-32" />
        <Shimmer className="h-[300px] w-full rounded-2xl" />
      </div>

      {/* Gallery */}
      <div className="mb-8">
        <Shimmer className="mb-3.5 h-6 w-28" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Shimmer key={i} className="aspect-[4/3] rounded-xl" />
          ))}
        </div>
      </div>

      {/* Doctors */}
      <div>
        <Shimmer className="mb-3.5 h-6 w-48" />
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[900px]:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardShimmer key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
