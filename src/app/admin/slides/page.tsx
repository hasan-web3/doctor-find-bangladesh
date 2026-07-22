import { asc } from "drizzle-orm";
import { db, heroSlides } from "@/db";
import { SlidesManager, type SlideRow } from "./manager";

export const dynamic = "force-dynamic";

export default async function AdminSlidesPage() {
  const rows = (await db
    .select({
      id: heroSlides.id,
      title: heroSlides.title,
      text: heroSlides.text,
      icon: heroSlides.icon,
      cta_label: heroSlides.ctaLabel,
      cta_href: heroSlides.ctaHref,
      sort: heroSlides.sort,
      active: heroSlides.active,
      image_url: heroSlides.imageUrl,
    })
    .from(heroSlides)
    .orderBy(asc(heroSlides.sort), asc(heroSlides.id))) as SlideRow[];

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">স্লাইডার ও ব্যানার</h1>
      <p className="mb-5 mt-0 text-sm text-ink-faint">হোমপেজের হিরো স্লাইড পরিচালনা করুন। প্রথম ছবিযুক্ত স্লাইডের ছবিটি হিরো সেকশনের প্রধান ছবি হিসেবে দেখানো হয়।</p>
      <SlidesManager rows={rows} />
    </div>
  );
}
