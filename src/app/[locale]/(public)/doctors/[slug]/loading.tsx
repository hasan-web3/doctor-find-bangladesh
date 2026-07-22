import { Shimmer } from "@/components/shimmer";

function ProfileHeaderShimmer() {
  return (
    <div className="flex flex-wrap gap-5 rounded-[20px] border border-line bg-white p-[26px]">
      <Shimmer className="h-[110px] w-[110px] shrink-0 rounded-[22px]" />
      <div className="min-w-[220px] flex-1">
        <div className="mb-2 flex items-center gap-2.5">
          <Shimmer className="h-8 w-64 max-w-full" />
          <Shimmer className="h-6 w-20 rounded-full" />
        </div>
        <Shimmer className="mb-2 h-6 w-40" />
        <Shimmer className="mb-3 h-4 w-full" />
        <div className="flex flex-wrap gap-5">
          <Shimmer className="h-5 w-24" />
          <Shimmer className="h-5 w-28" />
        </div>
      </div>
    </div>
  );
}

function ContentCardShimmer() {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-white p-6">
      {/* Bio */}
      <Shimmer className="mb-3 h-6 w-32" />
      <div className="mb-6 space-y-2.5">
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-5/6" />
      </div>

      {/* Chambers */}
      <Shimmer className="mb-3.5 h-6 w-48" />
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-[14px] border border-line p-[18px]">
            <Shimmer className="mb-2 h-5 w-1/2" />
            <Shimmer className="mb-3.5 h-4 w-3/4" />
            <div className="space-y-2.5">
              <Shimmer className="h-10 w-full rounded-[10px]" />
              <Shimmer className="h-10 w-full rounded-[10px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionCardShimmer() {
  return (
    <div className="sticky top-[88px] rounded-[18px] border border-line bg-white p-[22px] shadow-card">
      <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
        <Shimmer className="h-5 w-20" />
        <Shimmer className="h-8 w-28" />
      </div>
      <Shimmer className="mb-2.5 h-12 w-full rounded-xl" />
      <Shimmer className="h-12 w-full rounded-xl" />
      <Shimmer className="mt-4 h-16 w-full rounded-xl" />
    </div>
  );
}

export default function DoctorDetailLoading() {
  return (
    <div className="bg-page">
      <div className="mx-auto max-w-[1100px] px-5 pb-[100px] pt-[26px]">
        {/* Breadcrumbs */}
        <Shimmer className="mb-6 h-4 w-96 max-w-full" />

        <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[1fr_320px]">
          <div>
            <ProfileHeaderShimmer />
            <ContentCardShimmer />
          </div>
          <ActionCardShimmer />
        </div>
      </div>
    </div>
  );
}
