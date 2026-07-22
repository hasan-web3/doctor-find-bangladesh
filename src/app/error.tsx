"use client";

import { usePathname } from "next/navigation";

const COPY = {
  bn: {
    title: "কিছু একটা সমস্যা হয়েছে",
    body: "সার্ভারে একটি ত্রুটি ঘটেছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    devHint: "(ডেভেলপারদের জন্য: যদি এটি নতুন ইনস্টলেশন হয়, তাহলে .env ফাইলে DATABASE_URL ঠিক আছে কিনা দেখুন এবং",
    devHintTail: "চালান।)",
    retry: "আবার চেষ্টা করুন",
  },
  en: {
    title: "Something went wrong",
    body: "The server ran into an error. Please try again in a moment.",
    devHint: "(For developers: if this is a fresh install, check that DATABASE_URL is set correctly in .env and run",
    devHintTail: ".)",
    retry: "Try again",
  },
};

// Root-level error boundary. Reads locale from the URL so /en/* users see English
// even though this component sits outside the [locale] segment.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  const locale = pathname?.startsWith("/en") ? "en" : "bn";
  const t = COPY[locale];

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-page px-5 py-[60px] text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-warm-soft text-3xl">⚠️</div>
      <h1 className="mb-3 mt-0 font-heading text-[24px] font-bold text-ink">{t.title}</h1>
      <p className="mb-2 max-w-[480px] text-base text-ink-mute">{t.body}</p>
      <p className="mb-6 max-w-[480px] text-[13px] text-ink-ghost">
        {t.devHint} <code className="font-latin">npm run setup</code> {t.devHintTail}
      </p>
      <button
        onClick={reset}
        className="rounded-xl bg-brand-600 px-[26px] py-[13px] text-[15px] font-bold text-white transition-colors hover:bg-brand-700"
      >
        {t.retry}
      </button>
    </div>
  );
}
