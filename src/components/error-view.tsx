"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Shared UI for the user-facing error boundaries (root + public segment).
// Keep this copy short and non-technical. No setup instructions, no env var
// names, no error text: a visitor only needs to know it is temporary and
// where to go next. Diagnostics belong in the server logs.
const COPY = {
  bn: {
    title: "পেজটি এখন দেখানো যাচ্ছে না",
    body: "সাময়িক একটি সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
    retry: "আবার চেষ্টা করুন",
    home: "হোমে ফিরে যান",
    findDoctor: "ডাক্তার খুঁজুন",
    homeHref: "/",
    doctorsHref: "/doctors",
  },
  en: {
    title: "We can't show this page right now",
    body: "Something went wrong on our side. Please try again in a moment.",
    retry: "Try again",
    home: "Go home",
    findDoctor: "Find a doctor",
    homeHref: "/en",
    doctorsHref: "/en/doctors",
  },
};

export function ErrorView({ reset }: { reset: () => void }) {
  const pathname = usePathname();
  const locale = pathname?.startsWith("/en") ? "en" : "bn";
  const t = COPY[locale];

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-page px-5 py-[60px] text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-warm-soft text-3xl">⚠️</div>
      <h1 className="mb-3 mt-0 font-heading text-[24px] font-bold text-ink">{t.title}</h1>
      <p className="mb-[26px] max-w-[420px] text-base text-ink-mute">{t.body}</p>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-brand-600 px-[26px] py-[13px] text-[15px] font-bold text-white transition-colors hover:bg-brand-700"
        >
          {t.retry}
        </button>
        <Link
          href={t.homeHref}
          className="rounded-xl border-[1.5px] border-brand-600 bg-white px-[26px] py-[13px] text-[15px] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
        >
          {t.home}
        </Link>
        <Link
          href={t.doctorsHref}
          className="rounded-xl border-[1.5px] border-line bg-white px-[26px] py-[13px] text-[15px] font-semibold text-ink-soft transition-colors hover:bg-page"
        >
          {t.findDoctor}
        </Link>
      </div>
    </div>
  );
}
