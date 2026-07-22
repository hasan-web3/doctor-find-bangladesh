import { Shimmer } from "@/components/shimmer";

function PlanCardShimmer({ popular }: { popular?: boolean }) {
  return (
    <div className={`rounded-[20px] border-2 bg-white px-6 py-7 ${popular ? "border-transparent" : "border-line"}`}>
      <div className="mb-1.5 h-6 w-2/3">
        <Shimmer className="h-full w-full" />
      </div>
      <div className="mb-5 h-9 w-1/2">
        <Shimmer className="h-full w-full" />
      </div>
      <div className="mb-6 flex flex-col gap-[11px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-4 w-full" style={{ width: `${100 - i * 10}%` }} />
        ))}
      </div>
      <Shimmer className="h-12 w-full rounded-[11px]" />
    </div>
  );
}

function FormShimmer() {
  return (
    <div className="rounded-[20px] border border-line bg-white p-7">
      <Shimmer className="mx-auto mb-5 h-6 w-56" />
      <div className="space-y-4">
        <Shimmer className="h-10 w-full rounded-lg" />
        <Shimmer className="h-10 w-full rounded-lg" />
        <Shimmer className="h-24 w-full rounded-lg" />
        <Shimmer className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function ForDoctorsLoading() {
  return (
    <div>
      {/* Hero */}
      <div className="bg-page">
        <div className="mx-auto max-w-[900px] px-5 py-14 text-center">
          <Shimmer className="mx-auto mb-4 h-8 w-24 rounded-full" />
          <Shimmer className="mx-auto mb-3.5 h-9 w-4/5" />
          <Shimmer className="mx-auto mb-6 h-5 w-3/5" />
          <Shimmer className="mx-auto h-14 w-52 rounded-xl" />
        </div>
      </div>

      {/* Plans */}
      <div className="mx-auto max-w-site px-5 py-14">
        <div className="mb-9 text-center">
          <Shimmer className="mx-auto mb-2 h-8 w-64" />
          <Shimmer className="mx-auto h-5 w-80" />
        </div>
        <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-3">
          <PlanCardShimmer />
          <div className="relative">
            <Shimmer className="absolute -top-[13px] left-1/2 h-6 w-24 -translate-x-1/2 rounded-full" />
            <PlanCardShimmer popular />
          </div>
          <PlanCardShimmer />
        </div>
      </div>

      {/* Lead form */}
      <div className="mx-auto max-w-[640px] px-5 pb-16">
        <FormShimmer />
      </div>
    </div>
  );
}
