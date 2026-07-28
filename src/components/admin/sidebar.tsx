"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo, Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { UnreadBadge, useNotifications } from "@/components/admin/notifications";

const NAV: { label: string; href: string; icon: string }[] = [
  { label: "ড্যাশবোর্ড", href: "/admin", icon: "chart" },
  { label: "ডাক্তার", href: "/admin/doctors", icon: "user" },
  { label: "বিভাগ", href: "/admin/specialties", icon: "activity" },
  { label: "জেলা", href: "/admin/districts", icon: "pin" },
  { label: "শহর / গ্রাম", href: "/admin/areas", icon: "pin" },
  { label: "হাসপাতাল", href: "/admin/hospitals", icon: "building" },
  { label: "অ্যাপয়েন্টমেন্ট", href: "/admin/appointments", icon: "calendar" },
  { label: "প্রমোশন ও পেমেন্ট", href: "/admin/promotions", icon: "shield" },
  { label: "লিড / যোগাযোগ", href: "/admin/leads", icon: "phone" },
  { label: "ব্লগ", href: "/admin/blog", icon: "book" },
  { label: "রিভিউ", href: "/admin/reviews", icon: "heart" },
  { label: "স্লাইডার ও ব্যানার", href: "/admin/slides", icon: "eye" },
  { label: "FAQ", href: "/admin/faqs", icon: "search" },
  { label: "মতামত", href: "/admin/testimonials", icon: "leaf" },
  { label: "স্ট্যাটিক পেজ", href: "/admin/pages", icon: "book" },
  { label: "SEO সেটিংস", href: "/admin/seo", icon: "search" },
  { label: "ইন্টিগ্রেশন", href: "/admin/integrations", icon: "cross" },
  { label: "সাইট সেটিংস", href: "/admin/settings", icon: "clock" },
  { label: "ইউজার", href: "/admin/users", icon: "user" },
];

// `/admin/leads` → `leads`. Notification panels are keyed by this segment.
const segmentOf = (href: string) => href.split("/")[2] ?? "";

export function AdminSidebar() {
  const pathname = usePathname();
  // Read-only here on purpose: clicking a menu item must NOT clear its badge.
  // The badge stays until the admin opens the actual new row in the list.
  const { counts } = useNotifications();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <aside className="flex flex-col bg-ink text-[#CBD5E1] md:sticky md:top-0 md:h-screen">
      <div className="flex items-center gap-[9px] border-b border-white/10 px-[18px] py-5">
        <Logo light size={30} />
        <span className="font-heading text-[17px] font-bold leading-tight text-white">
          ডক্টরস ফাইন্ড <span className="text-brand-300">বাংলাদেশ</span>
        </span>
        <span className="ml-auto rounded-md bg-brand-300/15 px-2 py-[3px] text-[10.5px] font-bold text-brand-300">অ্যাডমিন</span>
      </div>
      <nav className="flex flex-row gap-0.5 overflow-x-auto p-2.5 md:flex-col md:overflow-x-visible md:overflow-y-auto">
        {NAV.map((item) => {
          const segment = segmentOf(item.href);
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-[11px] rounded-[9px] px-[13px] py-2.5 text-sm font-semibold transition-colors",
                active ? "bg-brand-600 text-white" : "text-ink-ghost hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon name={item.icon} size={19} className="shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
              <UnreadBadge count={counts[segment] ?? 0} active={active} />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
