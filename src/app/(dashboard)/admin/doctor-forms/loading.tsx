import { Shimmer } from "@/components/shimmer";

export default function AdminDoctorFormsLoading() {
  return (
    <div>
      <Shimmer className="mb-2 h-8 w-52" />
      <Shimmer className="mb-5 h-4 w-80" />

      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <Shimmer className="h-12 w-full max-w-[340px] rounded-[10px]" />
        <div className="flex gap-2">
          <Shimmer className="h-10 w-36 rounded-full" />
          <Shimmer className="h-12 w-56 rounded-[10px]" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white p-1.5">
        <div className="w-full min-w-[820px]">
          <div className="flex justify-between border-b border-line px-3.5 py-3.5">
            {["w-28", "w-24", "w-20", "w-16", "w-24", "w-20"].map((w, i) => (
              <Shimmer key={i} className={`h-4 ${w}`} />
            ))}
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-3.5 py-5">
                {["w-28", "w-24", "w-20", "w-16", "w-24", "w-20"].map((w, j) => (
                  <Shimmer key={j} className={`h-4 ${w}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
