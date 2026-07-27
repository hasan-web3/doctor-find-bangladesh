import { Shimmer } from "@/components/shimmer";

function ProfileHeaderShimmer() {
  return (
    <div className="rounded-[20px] border border-line bg-white p-[26px]">
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
          <div className="mt-4 flex flex-wrap gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Shimmer key={i} className="h-10 w-10 rounded-full" />
            ))}
          </div>
        </div>
        <div className="w-full shrink-0 basis-full md:ml-auto md:w-auto md:basis-auto">
          <Shimmer className="h-12 w-full rounded-xl md:w-52" />
        </div>
      </div>
    </div>
  );
}

function SectionCardShimmer({ titleWidth = "w-40", rows = 3 }: { titleWidth?: string; rows?: number }) {
  return (
    <div className="mt-4 rounded-2xl border border-line bg-white p-6">
      <Shimmer className={`mb-4 h-7 ${titleWidth}`} />
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <Shimmer key={i} className={`h-4 ${i === rows - 1 ? "w-4/6" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

function ChamberCardShimmer() {
  return (
    <div className="mb-5 rounded-[14px] border border-line p-6">
      <Shimmer className="mb-4 h-6 w-1/2" />
      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
        <Shimmer className="h-5 w-56" />
        <Shimmer className="h-5 w-24" />
        <Shimmer className="h-5 w-32" />
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Shimmer key={i} className="h-11 w-full rounded-[10px]" />
        ))}
      </div>
      <div className="mt-4 flex justify-center md:justify-start">
        <Shimmer className="h-11 w-48 rounded-xl" />
      </div>
    </div>
  );
}

export default function DoctorDetailLoading() {
  return (
    <div className="bg-page">
      <div className="mx-auto max-w-site px-5 pb-[100px] pt-[26px]">
        {/* Breadcrumbs */}
        <Shimmer className="mb-4 h-3.5 w-64 max-w-full" />

        <ProfileHeaderShimmer />

        {/* Bio card */}
        <SectionCardShimmer titleWidth="w-48" rows={4} />

        {/* Treated conditions */}
        <div className="mt-4 rounded-2xl border border-line bg-white p-6">
          <Shimmer className="mb-4 h-7 w-56" />
          <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Shimmer key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>

        {/* Chambers & schedule */}
        <div className="mt-4 rounded-2xl border border-line bg-white p-6">
          <Shimmer className="mb-4 h-7 w-56" />
          <ChamberCardShimmer />
          <ChamberCardShimmer />
        </div>

        {/* Reviews */}
        <div className="mt-4 rounded-2xl border border-line bg-white p-6">
          <Shimmer className="mb-4 h-7 w-44" />
          <div className="flex flex-col gap-3.5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-[14px] border border-line p-4">
                <div className="mb-2 flex items-center gap-3">
                  <Shimmer className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Shimmer className="mb-1 h-4 w-32" />
                    <Shimmer className="h-3 w-40" />
                  </div>
                </div>
                <Shimmer className="mb-2 h-4 w-full" />
                <Shimmer className="h-4 w-5/6" />
              </div>
            ))}
          </div>
        </div>

        {/* Suggested doctors slider */}
        <div className="mt-4 rounded-2xl border border-line bg-white p-6">
          <div className="mb-6 flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
            <Shimmer className="h-7 w-64 max-w-full" />
            <Shimmer className="h-11 w-full rounded-[10px] md:w-32" />
          </div>
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[1100px]:grid-cols-3 min-[1400px]:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-line bg-white p-5">
                <div className="flex items-start gap-3.5">
                  <Shimmer className="h-14 w-14 rounded-[14px]" />
                  <div className="flex-1 space-y-2">
                    <Shimmer className="h-4 w-3/4" />
                    <Shimmer className="h-3.5 w-1/2" />
                  </div>
                </div>
                <Shimmer className="mt-4 h-3 w-full" />
                <Shimmer className="mt-2 h-3 w-2/3" />
                <div className="mt-4 flex gap-2">
                  <Shimmer className="h-10 flex-1 rounded-[10px]" />
                  <Shimmer className="h-10 flex-1 rounded-[10px]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
