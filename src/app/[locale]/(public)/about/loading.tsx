import { Shimmer } from "@/components/shimmer";

function ValueCardShimmer() {
  return (
    <div className="rounded-2xl border border-line bg-white px-[22px] py-[26px]">
      <Shimmer className="mb-4 h-[52px] w-[52px] rounded-[14px]" />
      <Shimmer className="mb-[7px] h-6 w-3/4" />
      <div className="space-y-2">
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-5/6" />
      </div>
    </div>
  );
}

export default function AboutLoading() {
  return (
    <div>
      {/* Hero */}
      <div className="bg-page">
        <div className="mx-auto max-w-[820px] px-5 py-[52px] text-center">
          <Shimmer className="mx-auto mb-3.5 h-9 w-80 max-w-full" />
          <div className="mx-auto max-w-lg space-y-2.5">
            <Shimmer className="h-5 w-full" />
            <Shimmer className="h-5 w-3/4" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-brand-700">
        <div className="mx-auto grid max-w-[1000px] grid-cols-2 gap-[18px] px-5 py-9 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="text-center">
              <Shimmer className="mx-auto h-9 w-20" />
              <Shimmer className="mx-auto mt-2 h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Values */}
      <div className="mx-auto max-w-[1000px] px-5 py-14">
        <Shimmer className="mx-auto mb-9 h-8 w-48" />
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-3">
          <ValueCardShimmer />
          <ValueCardShimmer />
          <ValueCardShimmer />
        </div>
      </div>

      {/* CTA */}
      <div className="bg-page">
        <div className="mx-auto max-w-[800px] px-5 py-12 text-center">
          <Shimmer className="mx-auto mb-5 h-7 w-96 max-w-full" />
          <Shimmer className="mx-auto h-14 w-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
