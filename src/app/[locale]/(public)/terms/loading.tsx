import { Shimmer } from "@/components/shimmer";

export default function TermsLoading() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[80px] pt-[26px]">
      {/* Header card (gradient) */}
      <div className="mb-8 rounded-3xl border border-line bg-gradient-to-br from-brand-50 to-white p-8 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
        <Shimmer className="mb-3 h-10 w-3/4 max-w-md" />
        <div className="max-w-[560px] space-y-2">
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-11/12" />
        </div>
        <Shimmer className="mt-4 h-7 w-40 rounded-full" />
      </div>

      {/* Prose card */}
      <div className="rounded-3xl border border-line bg-white p-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="mb-8">
            <Shimmer className="mb-3 h-6 w-1/2" />
            <div className="space-y-2.5">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-11/12" />
              <Shimmer className="h-4 w-5/6" />
              <Shimmer className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
