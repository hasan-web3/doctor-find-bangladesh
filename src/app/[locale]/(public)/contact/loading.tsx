import { Shimmer } from "@/components/shimmer";

function InfoCardShimmer() {
  return (
    <div className="rounded-[18px] border border-line bg-white p-6">
      <Shimmer className="mb-3.5 h-[52px] w-[52px] rounded-[14px]" />
      <Shimmer className="mb-2 h-6 w-3/4" />
      <Shimmer className="mb-4 h-4 w-full" />
      <Shimmer className="h-4 w-1/2" />
    </div>
  );
}

function FormShimmer() {
  return (
    <div className="rounded-[18px] border border-line bg-white p-[26px]">
      <Shimmer className="mb-6 h-6 w-48" />
      <div className="space-y-4">
        <Shimmer className="h-11 w-full rounded-lg" />
        <Shimmer className="h-11 w-full rounded-lg" />
        <Shimmer className="h-11 w-full rounded-lg" />
        <Shimmer className="h-28 w-full rounded-lg" />
        <Shimmer className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

function DetailsShimmer() {
  return (
    <div>
      <div className="mb-4 rounded-[18px] border border-line p-6">
        <Shimmer className="mb-4 h-6 w-3/4" />
        <div className="space-y-3">
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-5/6" />
          <Shimmer className="h-4 w-4/5" />
        </div>
      </div>
      <Shimmer className="h-[190px] w-full rounded-[18px]" />
    </div>
  );
}

export default function ContactLoading() {
  return (
    <div>
      {/* Hero (dark gradient band) — mirrors the real page so the layout does
          not jump when the content swaps in. */}
      <div className="[background:linear-gradient(120deg,#0F172A,#134E4A)]">
        <div className="mx-auto max-w-[900px] px-5 py-14 text-center">
          <Shimmer className="mx-auto mb-4 h-8 w-40 rounded-full" />
          <Shimmer className="mx-auto mb-3 h-10 w-4/5" />
          <Shimmer className="mx-auto mb-6 h-5 w-3/5" />
          <Shimmer className="mx-auto h-14 w-64 rounded-xl" />
        </div>
      </div>

      <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      {/* Breadcrumbs */}
      <Shimmer className="mb-4 h-3.5 w-40" />
      {/* Title and Subtitle */}
      <Shimmer className="mb-2 h-8 w-64 max-w-full" />
      <Shimmer className="mb-7 h-4 w-80 max-w-full" />

      {/* Info Cards */}
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InfoCardShimmer />
        <InfoCardShimmer />
      </div>

      {/* Form and Details */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormShimmer />
        <DetailsShimmer />
      </div>
      </div>
    </div>
  );
}
