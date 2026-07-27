import { Shimmer } from "@/components/shimmer";

export default function ArticleLoading() {
  return (
    <div className="mx-auto max-w-site px-5 pb-[60px] pt-[26px]">
      {/* Breadcrumbs */}
      <Shimmer className="mb-4 h-3.5 w-72 max-w-full" />

      <article>
        {/* Meta */}
        <Shimmer className="mb-2.5 h-4 w-40" />
        {/* Title */}
        <Shimmer className="mb-3 h-10 w-full max-w-2xl" />
        <Shimmer className="mb-5 h-10 w-4/6 max-w-xl" />
        {/* Excerpt */}
        <div className="mb-5 space-y-2">
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-11/12" />
        </div>

        {/* Cover image floats right on md+ */}
        <div className="mb-5 md:float-right md:ml-6 md:mb-3 md:mt-1 md:w-[44%] md:max-w-[520px]">
          <Shimmer className="aspect-[16/10] w-full rounded-2xl" />
        </div>

        {/* Body paragraphs */}
        <div className="space-y-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2.5">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-11/12" />
              <Shimmer className="h-4 w-4/6" />
            </div>
          ))}
        </div>
        <div className="clear-both" />
      </article>

      {/* Bottom cards row */}
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-warm-border bg-warm-soft p-5">
          <Shimmer className="mb-2 h-4 w-full" />
          <Shimmer className="mb-2 h-4 w-11/12" />
          <Shimmer className="h-4 w-3/4" />
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-brand-100 bg-brand-50 p-5">
          <Shimmer className="h-5 w-3/4" />
          <Shimmer className="h-11 w-full rounded-[11px]" />
        </div>
      </div>
    </div>
  );
}
