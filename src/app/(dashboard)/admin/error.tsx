"use client";

// Admin-side boundary. Same short, plain message as the public pages, just with
// admin-appropriate links. The underlying Error is not printed here either;
// Next.js logs it server-side, which is where it belongs.
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-warm-soft text-2xl">⚠️</div>
      <h1 className="mb-2 mt-0 font-heading text-[22px] font-bold text-ink">
        পেজটি এখন দেখানো যাচ্ছে না
      </h1>
      <p className="mb-6 max-w-[420px] text-[14.5px] text-ink-mute">
        সাময়িক একটি সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।
        <span className="mt-1 block text-ink-faint">
          Something went wrong. Please try again in a moment.
        </span>
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-brand-600 px-[24px] py-[11px] text-[14.5px] font-bold text-white transition-colors hover:bg-brand-700"
        >
          আবার চেষ্টা করুন
        </button>
        <a
          href="/admin"
          className="rounded-xl border-[1.5px] border-line bg-white px-[24px] py-[11px] text-[14.5px] font-semibold text-ink-soft transition-colors hover:bg-page"
        >
          ড্যাশবোর্ডে ফিরুন
        </a>
      </div>
    </div>
  );
}
