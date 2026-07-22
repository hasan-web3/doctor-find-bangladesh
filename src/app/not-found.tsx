"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const COPY = {
  bn: {
    code: "৪০৪",
    title: "দুঃখিত, পেজটি খুঁজে পাওয়া যায়নি",
    body: "আপনি যে পেজটি খুঁজছেন সেটি হয়তো সরিয়ে ফেলা হয়েছে বা এর ঠিকানা পরিবর্তন হয়েছে।",
    home: "হোমে ফিরে যান",
    findDoctor: "ডাক্তার খুঁজুন",
    homeHref: "/",
    doctorsHref: "/doctors",
  },
  en: {
    code: "404",
    title: "Sorry, we couldn't find that page",
    body: "The page you're looking for may have been moved or its address has changed.",
    home: "Go home",
    findDoctor: "Find a doctor",
    homeHref: "/en",
    doctorsHref: "/en/doctors",
  },
};

// Locale-aware 404: /en/* users see English, everyone else sees Bangla.
// Marked "use client" so we can read the URL — kept minimal to stay small.
export default function NotFound() {
  const pathname = usePathname();
  const locale = pathname?.startsWith("/en") ? "en" : "bn";
  const t = COPY[locale];

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-page px-5 py-[60px] text-center">
      <div className="font-heading text-[clamp(80px,18vw,140px)] font-extrabold leading-none text-brand-600">{t.code}</div>
      <h1 className="mb-3 mt-2 font-heading text-[26px] font-bold text-ink">{t.title}</h1>
      <p className="mb-[26px] max-w-[440px] text-base text-ink-mute">{t.body}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href={t.homeHref} className="rounded-xl bg-brand-600 px-[26px] py-[13px] text-[15px] font-bold text-white transition-colors hover:bg-brand-700">
          {t.home}
        </Link>
        <Link href={t.doctorsHref} className="rounded-xl border-[1.5px] border-brand-600 bg-white px-[26px] py-[13px] text-[15px] font-semibold text-brand-700 transition-colors hover:bg-brand-50">
          {t.findDoctor}
        </Link>
      </div>
    </div>
  );
}
