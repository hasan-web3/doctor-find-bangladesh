import { Shimmer } from "@/components/shimmer";

function StatCardShimmer() {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <Shimmer className="mb-3.5 h-11 w-11 rounded-xl" />
      <Shimmer className="h-8 w-20" />
      <Shimmer className="mt-[5px] h-4 w-28" />
    </div>
  );
}

function TableShimmer({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white p-[22px]">
      <Shimmer className="mb-4 h-6 w-48" />
      <div className="w-full min-w-[500px]">
        <div className="flex justify-between border-b border-line px-3 pb-2.5">
          {Array.from({ length: cols }).map((_, i) => (
            <Shimmer key={i} className="h-4 w-16" />
          ))}
        </div>
        <div className="divide-y divide-[#F1F5F9]">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-4">
              {Array.from({ length: cols }).map((_, j) => (
                <Shimmer key={j} className="h-4 w-20" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardLoading() {
  return (
    <div>
      <Shimmer className="mb-5 h-8 w-48" />

      {/* Stat cards */}
      <div className="mb-[22px] grid grid-cols-2 gap-4 min-[900px]:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardShimmer key={i} />
        ))}
      </div>

      <div className="mb-[22px] grid grid-cols-1 gap-4 min-[1000px]:grid-cols-[1.7fr_1fr]">
        {/* Chart */}
        <div className="rounded-2xl border border-line bg-white p-[22px]">
          <Shimmer className="mb-5 h-5 w-56" />
          <div className="flex h-[180px] items-end gap-3.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <Shimmer key={i} className="h-full w-full" />
            ))}
          </div>
        </div>

        {/* Expiring */}
        <div className="rounded-2xl border border-line bg-white p-[22px]">
          <Shimmer className="mb-4 h-6 w-40" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-[11px] p-3">
                <Shimmer className="h-[38px] w-[38px] rounded-[10px]" />
                <div className="flex-1 space-y-2">
                  <Shimmer className="h-4 w-full" />
                  <Shimmer className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Appointments Table */}
      <TableShimmer rows={6} cols={4} />
    </div>
  );
}
