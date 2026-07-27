import { Shimmer, CardShimmer } from "@/components/shimmer";

function FiltersShimmer() {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      {Array.from({ length: 4 }).map((_, i) => (
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

export default function DistrictDoctorsLoading() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      <Shimmer className="mb-4 h-3.5 w-72 max-w-full" />
      <Shimmer className="mb-1.5 h-9 w-3/4 max-w-md" />
      <Shimmer className="mb-6 h-4 w-96 max-w-full" />

      <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[260px_1fr]">
        <FiltersShimmer />

        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Shimmer className="h-11 flex-grow rounded-lg" />
            <Shimmer className="h-11 w-40 rounded-lg" />
          </div>

          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[1100px]:grid-cols-3 min-[1400px]:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <CardShimmer key={i} />
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <Shimmer className="h-9 w-40" />
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Shimmer key={i} className="h-9 w-9 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
