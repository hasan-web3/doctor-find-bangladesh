import { Suspense } from 'react';
import Loading from './loading';
import Link from "next/link";
import { AdminSidebar } from "@/components/admin/sidebar";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#F1F5F9] md:grid-cols-[236px_1fr]">
      <AdminSidebar />
      <div className="flex min-w-0 flex-col">
        {/* topbar */}
        <div className="sticky top-0 z-20 flex items-center gap-4 border-b border-line bg-white px-[22px] py-3">
          <Link href="/" className="whitespace-nowrap text-[13.5px] font-semibold text-brand-600">
            ← সাইটে ফিরুন
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-[9px]">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-heading font-semibold text-white">
              {session?.name?.[0] || "অ্যা"}
            </div>
            <div className="hidden sm:block">
              <div className="text-[13.5px] font-bold leading-tight text-ink">{session?.name || "অ্যাডমিন"}</div>
              <div className="text-xs text-ink-ghost">
                {session?.role === "super_admin" ? "সুপার অ্যাডমিন" : session?.role === "editor" ? "এডিটর" : "অ্যাডমিন"}
              </div>
            </div>
          </div>
          <form action={logoutAction}>
            <button className="rounded-[9px] border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-mute hover:bg-page">
              লগআউট
            </button>
          </form>
        </div>
        <div className="px-[22px] pb-[60px] pt-6"><Suspense fallback={<Loading />}>{children}</Suspense></div>
      </div>
    </div>
  );
}
