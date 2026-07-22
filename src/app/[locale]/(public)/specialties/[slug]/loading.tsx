import { Shimmer, CardShimmer } from "@/components/shimmer";

function FaqShimmer() {
  return (
    <div className="mx-auto max-w-[820px] px-5 pb-[60px] pt-[34px]">
      <Shimmer className="mx-auto mb-[18px] h-7 w-80 max-w-full" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-[14px] border border-line bg-white px-5 py-[18px]">
            <Shimmer className="mb-2 h-5 w-3/4" />
            <Shimmer className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DoctorListLoading() {
  return (
    <div>
      {/* Hero */}
      <div className="bg-page">
        <div className="mx-auto max-w-[1100px] px-5 pb-10 pt-[26px]">
          <Shimmer className="mb-6 h-4 w-96 max-w-full" />
          <Shimmer className="mb-3.5 h-10 w-4/5" />
          <div className="max-w-[760px] space-y-2.5">
            <Shimmer className="h-5 w-full" />
            <Shimmer className="h-5 w-2/3" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1100px] px-5 pb-5 pt-9">
        <Shimmer className="mb-5 h-7 w-96" />
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[900px]:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <CardShimmer key={i} />
          ))}
        </div>
        {/* Pagination will be client-side, so no shimmer needed initially */}
      </div>

      {/* Interlinks / FAQs */}
      <FaqShimmer />
    </div>
  );
}
