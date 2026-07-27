import { Shimmer } from "@/components/shimmer";

function DoctorSummaryShimmer() {
  return (
    <div className="mb-6 rounded-[20px] border border-line bg-white p-[26px]">
      <div className="flex flex-wrap items-start gap-5 sm:gap-7">
        <Shimmer className="mx-auto h-[140px] w-[140px] shrink-0 rounded-[22px] sm:mx-0" />
        <div className="min-w-[220px] flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2.5">
            <Shimmer className="h-8 w-64 max-w-full" />
            <Shimmer className="h-6 w-24 rounded-full" />
          </div>
          <Shimmer className="mb-2 h-5 w-52" />
          <Shimmer className="mb-2 h-4 w-40" />
          <Shimmer className="mb-3 h-4 w-72 max-w-full" />
          <div className="flex flex-wrap gap-5">
            <Shimmer className="h-5 w-28" />
            <Shimmer className="h-5 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}

function WizardShimmer() {
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <Shimmer className="h-8 w-8 shrink-0 rounded-full" />
            <Shimmer className="h-3 flex-1" />
          </div>
        ))}
      </div>

      <Shimmer className="mb-5 h-6 w-48" />

      {/* Chamber options */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-[14px] border border-line p-4">
            <Shimmer className="mb-2 h-5 w-3/4" />
            <Shimmer className="mb-2 h-4 w-full" />
            <Shimmer className="h-4 w-1/2" />
          </div>
        ))}
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        <Shimmer className="h-11 w-full rounded-lg" />
        <Shimmer className="h-11 w-full rounded-lg" />
        <div className="flex gap-4">
          <Shimmer className="h-11 flex-1 rounded-lg" />
          <Shimmer className="h-11 flex-1 rounded-lg" />
        </div>
        <Shimmer className="h-28 w-full rounded-lg" />
        <Shimmer className="mt-2 h-13 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function AppointmentLoading() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[70px] pt-[26px]">
      <Shimmer className="mb-4 h-3.5 w-80 max-w-full" />
      <Shimmer className="mb-5 h-9 w-64" />
      <DoctorSummaryShimmer />
      <WizardShimmer />
    </div>
  );
}
