import { Shimmer } from "@/components/shimmer";

function FormSection({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-white p-6">{children}</div>;
}

export default function DoctorFormLoading() {
  return (
    <div className="max-w-[980px]">
      <Shimmer className="mb-5 h-8 w-72" />

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-[220px_1fr]">
        {/* Left Column */}
        <div>
          <Shimmer className="mb-4 h-56 w-full rounded-2xl" />
          <div className="space-y-3 rounded-xl border border-line bg-white p-4">
            <Shimmer className="h-6 w-3/4 rounded" />
            <Shimmer className="h-6 w-full rounded" />
            <Shimmer className="h-6 w-5/6 rounded" />
          </div>
        </div>

        {/* Right Column (Main Fields) */}
        <FormSection>
          <div className="space-y-5">
            <Shimmer className="h-14 w-full" />
            <Shimmer className="h-14 w-full" />
            <Shimmer className="h-24 w-full" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Shimmer className="h-14 w-full" />
              <Shimmer className="h-14 w-full" />
            </div>
            <Shimmer className="h-32 w-full" />
          </div>
        </FormSection>
      </div>

      {/* Chambers Section */}
      <div className="mt-5">
        <FormSection>
          <Shimmer className="mb-4 h-6 w-48" />
          <div className="space-y-4">
            <div className="rounded-[14px] border border-line p-4 space-y-3">
              <Shimmer className="h-14 w-full" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Shimmer className="h-14 w-full" />
                <Shimmer className="h-14 w-full" />
              </div>
            </div>
          </div>
        </FormSection>
      </div>

      {/* SEO Section */}
      <div className="mt-5">
        <FormSection>
          <Shimmer className="mb-4 h-6 w-24" />
          <div className="space-y-4">
            <Shimmer className="h-14 w-full" />
            <Shimmer className="h-14 w-full" />
          </div>
        </FormSection>
      </div>

      {/* Buttons */}
      <div className="mt-5 flex gap-3">
        <Shimmer className="h-12 w-32 rounded-[10px]" />
        <Shimmer className="h-12 w-24 rounded-[10px]" />
      </div>
    </div>
  );
}
