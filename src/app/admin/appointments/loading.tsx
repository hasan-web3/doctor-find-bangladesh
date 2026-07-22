import { Shimmer } from "@/components/shimmer";

function AppointmentRowShimmer() {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Shimmer className="h-5 w-20" />
          <Shimmer className="h-5 w-32" />
          <Shimmer className="h-5 w-28" />
        </div>
        <Shimmer className="h-6 w-24 rounded-full" />
      </div>
      <div className="mt-4 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Shimmer className="h-4 w-48" />
          <Shimmer className="h-4 w-56" />
        </div>
      </div>
    </div>
  );
}

export default function AdminAppointmentsLoading() {
  return (
    <div>
      <Shimmer className="mb-5 h-8 w-64" />

      {/* Tabs and Search */}
      <div className="mb-[18px] flex flex-wrap items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="h-10 w-24 rounded-full" />
        ))}
        <div className="mr-auto w-full max-w-xs">
          <Shimmer className="h-10 w-full rounded-[10px]" />
        </div>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <AppointmentRowShimmer key={i} />
        ))}
      </div>
    </div>
  );
}
