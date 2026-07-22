import { Shimmer } from "@/components/shimmer";

function ProseShimmer() {
  return (
    <div className="rounded-2xl border border-line bg-white p-7">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="mb-6">
          <Shimmer className="mb-3 h-6 w-1/2" />
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

export default function PrivacyLoading() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      {/* Breadcrumbs */}
      <Shimmer className="mb-4 h-3.5 w-40" />
      {/* Title */}
      <Shimmer className="mb-6 h-8 w-64 max-w-full" />
      {/* Content */}
      <ProseShimmer />
    </div>
  );
}
