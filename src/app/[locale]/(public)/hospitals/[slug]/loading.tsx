import { Shimmer, CardShimmer } from "@/components/shimmer";

export default function HospitalDetailLoading() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      {/* Breadcrumbs */}
      <Shimmer className="mb-4 h-3.5 w-64 max-w-full" />

      {/* Map */}
      <Shimmer className="mb-6 h-[280px] w-full rounded-2xl" />

      {/* Gallery */}
      <div className="mb-6 grid grid-cols-4 gap-2">
        <Shimmer className="col-span-4 h-[280px] rounded-2xl sm:col-span-2 sm:row-span-2 sm:h-full" />
        <Shimmer className="hidden h-[135px] rounded-2xl sm:block" />
        <Shimmer className="hidden h-[135px] rounded-2xl sm:block" />
        <Shimmer className="hidden h-[135px] rounded-2xl sm:block" />
        <Shimmer className="hidden h-[135px] rounded-2xl sm:block" />
      </div>

      {/* Header card */}
      <div className="mb-6 rounded-[20px] border border-line bg-white p-[26px]">
        <Shimmer className="mb-2 h-9 w-3/4 max-w-md" />
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1">
          <Shimmer className="h-5 w-64 max-w-full" />
          <Shimmer className="h-5 w-32" />
        </div>
        <div className="mt-3 space-y-2">
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-11/12" />
          <Shimmer className="h-4 w-4/6" />
        </div>
      </div>

      {/* Departments chips */}
      <div className="mb-6">
        <Shimmer className="mb-3 h-6 w-40" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Shimmer key={i} className="h-9 w-28 rounded-full" />
          ))}
        </div>
      </div>

      {/* Doctors list header + filter row */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Shimmer className="h-7 w-56" />
        <Shimmer className="h-11 w-40 rounded-lg" />
      </div>

      {/* Doctor grid */}
      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[1100px]:grid-cols-3 min-[1400px]:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardShimmer key={i} />
        ))}
      </div>
    </div>
  );
}
