import { Shimmer } from "@/components/shimmer";

function DoctorSummaryShimmer() {
  return (
    <div className="mb-6 flex items-center gap-3.5 rounded-2xl border-line bg-page px-[18px] py-4">
      <Shimmer className="h-[54px] w-[54px] shrink-0 rounded-[14px]" />
      <div className="flex-1 space-y-1.5">
        <Shimmer className="h-5 w-40" />
        <Shimmer className="h-4 w-56" />
      </div>
      <div className="space-y-1">
        <Shimmer className="h-3 w-12" />
        <Shimmer className="h-5 w-16" />
      </div>
    </div>
  );
}

function WizardShimmer() {
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      {/* Step Title */}
      <Shimmer className="mb-5 h-6 w-48" />

      {/* Form Fields */}
      <div className="space-y-4">
        <Shimmer className="h-12 w-full rounded-lg" />
        <Shimmer className="h-24 w-full rounded-lg" />
        <div className="flex gap-4">
          <Shimmer className="h-12 flex-1 rounded-lg" />
          <Shimmer className="h-12 flex-1 rounded-lg" />
        </div>
        <Shimmer className="!mt-6 h-14 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function AppointmentLoading() {
  return (
    <div className="mx-auto max-w-[820px] px-5 pb-[70px] pt-[26px]">
      {/* Breadcrumbs & Title */}
      <Shimmer className="mb-4 h-4 w-56" />
      <Shimmer className="mb-5 h-8 w-64" />

      <DoctorSummaryShimmer />
      <WizardShimmer />
    </div>
  );
}
