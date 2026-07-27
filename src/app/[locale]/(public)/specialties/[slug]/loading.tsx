import { Shimmer, CardShimmer } from "@/components/shimmer";

export default function SpecialtyDetailLoading() {
  return (
    <div>
      {/* Hero (gradient bg) */}
      <div className="[background:linear-gradient(180deg,#F0FDFA,#F8FAFC)]">
        <div className="mx-auto max-w-site px-5 pb-10 pt-[26px]">
          <Shimmer className="mb-4 h-3.5 w-72 max-w-full" />
          <Shimmer className="mb-3.5 h-11 w-4/5 max-w-2xl" />
          <div className="max-w-[760px] space-y-2.5">
            <Shimmer className="h-5 w-full" />
            <Shimmer className="h-5 w-11/12" />
            <Shimmer className="h-5 w-2/3" />
          </div>
        </div>
      </div>

      {/* Listing */}
      <div className="mx-auto max-w-site px-5 pb-5 pt-9">
        <Shimmer className="mb-5 h-7 w-96 max-w-full" />

        {/* Filter row */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Shimmer className="h-11 flex-grow rounded-lg" />
          <Shimmer className="h-11 w-40 rounded-lg" />
        </div>

        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[1100px]:grid-cols-3 min-[1400px]:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardShimmer key={i} />
          ))}
        </div>
      </div>

      {/* Other specialties slider */}
      <div className="mx-auto max-w-site px-5 py-6">
        <Shimmer className="mb-3.5 h-6 w-56" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 min-[1100px]:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-line bg-white p-4">
              <Shimmer className="h-[52px] w-[52px] shrink-0 rounded-[14px]" />
              <div className="w-full">
                <Shimmer className="mb-1 h-4 w-3/4" />
                <Shimmer className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div className="mx-auto max-w-[820px] px-5 pb-[60px] pt-[34px]">
        <Shimmer className="mx-auto mb-[18px] h-7 w-80 max-w-full" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-[14px] border border-line bg-white px-5 py-[18px]">
              <Shimmer className="mb-2 h-5 w-3/4" />
              <Shimmer className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
