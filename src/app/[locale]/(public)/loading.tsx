import { Shimmer, CardShimmer } from "@/components/shimmer";

// A simplified shimmer for section headers
function SectionHeadShimmer() {
  return (
    <div className="mb-9 text-center">
      <Shimmer className="mx-auto mb-2 h-4 w-32" />
      <Shimmer className="mx-auto h-8 w-80 max-w-full" />
    </div>
  );
}

// Shimmer for the main hero section
function HeroShimmer() {
  return (
    <div className="overflow-hidden bg-page">
      <div className="mx-auto grid max-w-site grid-cols-1 items-center gap-10 px-5 pb-16 pt-14 min-[900px]:grid-cols-[1.1fr_.9fr]">
        <div>
          <Shimmer className="mb-4 h-8 w-48 rounded-full" />
          <Shimmer className="mb-3.5 h-12 w-full" />
          <Shimmer className="mb-3.5 h-12 w-3/4" />
          <Shimmer className="mb-5 h-5 w-full max-w-lg" />
          <Shimmer className="mb-4 h-14 w-full rounded-full" />
          <div className="flex flex-wrap items-center gap-2">
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-8 w-20 rounded-full" />
            <Shimmer className="h-8 w-24 rounded-full" />
            <Shimmer className="h-8 w-20 rounded-full" />
          </div>
        </div>
        <div className="hidden min-[900px]:block">
          <Shimmer className="aspect-[4/3] w-full rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

// Shimmer for a simple grid of cards (specialties, features)
function SimpleCardGridShimmer({ numCards = 6 }: { numCards?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-3.5 sm:grid-cols-3 min-[900px]:grid-cols-${numCards}`}>
      {Array.from({ length: numCards }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-white p-5 text-center">
          <Shimmer className="mx-auto mb-3 h-[52px] w-[52px] rounded-[14px]" />
          <Shimmer className="mx-auto h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

// Shimmer for the 'Find by Area' section
function AreaSectionShimmer() {
  return (
    <div className="bg-brand-50">
      <div className="mx-auto grid max-w-site grid-cols-1 items-center gap-[30px] px-5 py-14 min-[900px]:grid-cols-2">
        <div>
          <Shimmer className="mb-2 h-4 w-32" />
          <Shimmer className="mb-3 h-8 w-80 max-w-full" />
          <Shimmer className="mb-5 h-5 w-96 max-w-full" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Shimmer key={i} className="h-10 w-24 rounded-full" />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <Shimmer className="aspect-square w-full max-w-[360px] rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

export default function HomepageLoading() {
  return (
    <div>
      <HeroShimmer />
      <Shimmer className="h-24 w-full" /> {/* Stats Bar */}

      <div className="mx-auto max-w-site px-5 py-16">
        <SectionHeadShimmer />
        <SimpleCardGridShimmer numCards={6} />
      </div>

      <AreaSectionShimmer />

      <div className="mx-auto max-w-site px-5 py-16">
        <SectionHeadShimmer />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 min-[900px]:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardShimmer key={i} />
          ))}
        </div>
      </div>

      <div className="border-y border-line bg-page">
        <div className="mx-auto max-w-site px-5 py-[60px]">
          <SectionHeadShimmer />
          <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Shimmer key={i} className="h-48 rounded-[18px]" />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-site px-5 py-16">
        <SectionHeadShimmer />
        <SimpleCardGridShimmer numCards={4} />
      </div>
    </div>
  );
}
