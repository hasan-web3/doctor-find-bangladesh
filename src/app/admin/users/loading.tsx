import { Shimmer } from "@/components/shimmer";

function TableShimmer({ rows = 15, cols = 7 }: { rows?: number; cols?: number }) {
  const colWidths = ["w-32", "w-24", "w-20", "w-16", "w-12", "w-20", "w-24"];
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
      <div className="w-full min-w-[680px]">
        {/* Header */}
        <div className="flex justify-between border-b border-line px-3.5 py-3.5 text-right">
          {Array.from({ length: cols }).map((_, i) => (
            <Shimmer key={i} className={`h-4 ${colWidths[i] || "w-20"}`} />
          ))}
        </div>
        {/* Body */}
        <div className="divide-y divide-[#F1F5F9]">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-3.5 py-5">
              {Array.from({ length: cols }).map((_, j) => (
                <Shimmer key={j} className={`h-4 ${colWidths[j] || "w-20"}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminDoctorsLoading() {
  return (
    <div>
      <Shimmer className="mb-5 h-8 w-64" />

      {/* Search and actions */}
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <Shimmer className="h-12 w-full max-w-[340px] rounded-[10px]" />
        <div className="flex gap-2">
          <Shimmer className="h-10 w-20 rounded-full" />
          <Shimmer className="h-10 w-24 rounded-full" />
          <Shimmer className="h-12 w-48 rounded-[10px]" />
        </div>
      </div>

      {/* Table */}
      <TableShimmer />

      {/* Pagination */}
      <div className="flex items-center justify-between pt-5">
        <Shimmer className="h-9 w-24 rounded-lg" />
        <Shimmer className="h-4 w-32" />
        <Shimmer className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}
