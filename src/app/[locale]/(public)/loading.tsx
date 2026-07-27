import { Shimmer, CardShimmer } from "@/components/shimmer";

function SectionHeadShimmer({ centered = true }: { centered?: boolean }) {
  return (
    <div className={`mb-9 ${centered ? "text-center" : ""}`}>
      <Shimmer className={`mb-2 h-4 w-32 ${centered ? "mx-auto" : ""}`} />
      <Shimmer className={`h-8 w-80 max-w-full ${centered ? "mx-auto" : ""}`} />
    </div>
  );
}

function HeroShimmer() {
  return (
    <div className="[background:linear-gradient(180deg,#F0FDFA_0%,#F8FAFC_100%)]">
      <div className="mx-auto flex max-w-site flex-col gap-6 px-5 pb-16 pt-14 min-[900px]:grid min-[900px]:grid-cols-[1.1fr_.9fr] min-[900px]:items-center min-[900px]:gap-10">
        <div className="min-[900px]:col-start-1 min-[900px]:row-start-1">
          <Shimmer className="mb-[18px] h-8 w-56 rounded-full" />
          <Shimmer className="mb-3 h-12 w-full max-w-lg" />
          <Shimmer className="mb-3 h-12 w-3/4 max-w-md" />
          <Shimmer className="h-5 w-full max-w-[520px] min-[900px]:mb-[26px]" />
        </div>
        <div className="min-[900px]:col-start-2 min-[900px]:row-start-1 min-[900px]:row-span-3">
          <Shimmer className="aspect-[4/3] w-full rounded-3xl" />
        </div>
        <div className="min-[900px]:col-start-1 min-[900px]:row-start-2">
          <Shimmer className="h-14 w-full rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2 min-[900px]:col-start-1 min-[900px]:row-start-3 min-[900px]:mt-[18px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatsBarShimmer() {
  return (
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
  );
}

function SpecialtyTileShimmer() {
  return (
    <div className="flex h-full flex-col items-center gap-2.5 rounded-2xl border border-line bg-white px-3 py-5">
      <Shimmer className="h-[52px] w-[52px] rounded-[14px]" />
      <Shimmer className="h-4 w-20" />
      <Shimmer className="h-3 w-14" />
    </div>
  );
}

function AreaSectionShimmer() {
  return (
    <div className="bg-brand-50">
      <div className="mx-auto grid max-w-site grid-cols-1 items-center gap-[30px] px-5 py-14 min-[900px]:grid-cols-2">
        <div>
          <Shimmer className="mb-2 h-4 w-32" />
          <Shimmer className="mb-3 h-8 w-80 max-w-full" />
          <Shimmer className="mb-[22px] h-5 w-full max-w-[460px]" />
          <div className="flex flex-wrap gap-[9px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <Shimmer key={i} className="h-10 w-28 rounded-full" />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <Shimmer className="aspect-square w-full max-w-[420px] rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

function StepCardShimmer() {
  return (
    <div className="relative h-full rounded-[18px] border border-line bg-white px-6 py-[30px] text-center">
      <Shimmer className="absolute -top-4 left-1/2 h-[34px] w-[34px] -translate-x-1/2 rounded-full" />
      <Shimmer className="mx-auto mb-4 mt-2 h-[60px] w-[60px] rounded-2xl" />
      <Shimmer className="mx-auto mb-2 h-6 w-40" />
      <Shimmer className="mx-auto h-4 w-56 max-w-full" />
    </div>
  );
}

function FeatureCardShimmer() {
  return (
    <div className="h-full rounded-2xl border border-line bg-white px-[22px] py-[26px]">
      <Shimmer className="mb-4 h-[52px] w-[52px] rounded-[14px]" />
      <Shimmer className="mb-2 h-6 w-3/4" />
      <div className="space-y-2">
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-5/6" />
      </div>
    </div>
  );
}

function HospitalRowShimmer() {
  return (
    <div className="flex h-full items-center gap-4 rounded-2xl border border-line bg-white p-5">
      <Shimmer className="h-[54px] w-[54px] shrink-0 rounded-[14px]" />
      <div className="min-w-0 flex-1">
        <Shimmer className="mb-1.5 h-4 w-3/4" />
        <Shimmer className="h-3 w-1/2" />
      </div>
    </div>
  );
}

function BlogPreviewShimmer() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-white">
      <Shimmer className="h-[150px] w-full" />
      <div className="px-5 py-[18px]">
        <Shimmer className="mb-2 h-3 w-2/3" />
        <Shimmer className="mb-2 h-5 w-full" />
        <Shimmer className="h-4 w-24" />
      </div>
    </div>
  );
}

export default function HomepageLoading() {
  return (
    <>
      <HeroShimmer />
      <StatsBarShimmer />

      {/* Specialties (12 tiles: 2/3/6 cols) */}
      <div className="mx-auto max-w-site px-5 py-16">
        <SectionHeadShimmer />
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 min-[900px]:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <SpecialtyTileShimmer key={i} />
          ))}
        </div>
      </div>

      <AreaSectionShimmer />

      {/* Featured doctors */}
      <div className="mx-auto max-w-site px-5 py-16">
        <div className="mb-[30px] flex flex-wrap items-end justify-between gap-4">
          <div>
            <Shimmer className="mb-2 h-4 w-32" />
            <Shimmer className="h-8 w-80 max-w-full" />
          </div>
          <Shimmer className="h-11 w-40 rounded-[10px]" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 min-[1000px]:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardShimmer key={i} />
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="border-y border-line bg-page">
        <div className="mx-auto max-w-site px-5 py-[60px]">
          <SectionHeadShimmer />
          <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <StepCardShimmer key={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Why choose */}
      <div className="mx-auto max-w-site px-5 py-16">
        <SectionHeadShimmer />
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 min-[900px]:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <FeatureCardShimmer key={i} />
          ))}
        </div>
      </div>

      {/* Hospitals */}
      <div className="bg-brand-50">
        <div className="mx-auto max-w-site px-5 py-14">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Shimmer className="mb-2 h-4 w-32" />
              <Shimmer className="h-8 w-80 max-w-full" />
            </div>
            <Shimmer className="h-11 w-32 rounded-[10px]" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[900px]:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <HospitalRowShimmer key={i} />
            ))}
          </div>
        </div>
      </div>

      {/* CTA banner */}
      <div className="[background:linear-gradient(120deg,#0D9488,#0F766E)]">
        <div className="mx-auto max-w-[1000px] px-5 py-[52px] text-center">
          <Shimmer className="mx-auto mb-3 h-9 w-96 max-w-full" />
          <Shimmer className="mx-auto mb-6 h-5 w-80 max-w-full" />
          <Shimmer className="mx-auto h-14 w-48 rounded-xl" />
        </div>
      </div>

      {/* Blog preview */}
      <div className="border-t border-line bg-page">
        <div className="mx-auto max-w-site px-5 py-[60px]">
          <div className="mb-[30px] flex flex-wrap items-end justify-between gap-4">
            <div>
              <Shimmer className="mb-2 h-4 w-32" />
              <Shimmer className="h-8 w-64 max-w-full" />
            </div>
            <Shimmer className="h-11 w-32 rounded-[10px]" />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <BlogPreviewShimmer key={i} />
            ))}
          </div>
        </div>
      </div>

      {/* For doctors banner */}
      <div className="mx-auto max-w-site px-5 py-16">
        <div className="grid grid-cols-1 items-center gap-[30px] overflow-hidden rounded-3xl px-9 py-12 [background:linear-gradient(120deg,#0F172A,#134E4A)] min-[900px]:grid-cols-[1.2fr_.8fr]">
          <div>
            <Shimmer className="mb-4 h-7 w-32 rounded-full" />
            <Shimmer className="mb-3 h-9 w-full max-w-md" />
            <Shimmer className="mb-[22px] h-5 w-full max-w-[520px]" />
            <div className="flex flex-wrap gap-3">
              <Shimmer className="h-12 w-40 rounded-[11px]" />
              <Shimmer className="h-12 w-40 rounded-[11px]" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3.5">
                <Shimmer className="h-[30px] w-[30px] shrink-0 rounded-full" />
                <Shimmer className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Helpline strip */}
      <div className="border-t border-warm-border bg-warm-soft">
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-center gap-5 px-5 py-[34px]">
          <div className="text-center">
            <Shimmer className="mx-auto mb-1 h-6 w-40" />
            <Shimmer className="mx-auto h-4 w-64 max-w-full" />
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Shimmer className="h-12 w-48 rounded-[11px]" />
            <Shimmer className="h-12 w-40 rounded-[11px]" />
          </div>
        </div>
      </div>
    </>
  );
}
