"use client";

import { useActionState } from "react";
import { loginAction, type LoginResult } from "@/actions/auth";
import { Logo } from "@/components/icons";

export function LoginForm({ next }: { next: string }) {
  const [result, formAction, pending] = useActionState<LoginResult | null, FormData>(loginAction, null);

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10 [background:linear-gradient(140deg,#0F172A,#134E4A)]">
      <div className="w-full max-w-[400px] rounded-[20px] border border-line bg-white p-8 shadow-[0_12px_34px_rgba(15,23,42,.07)]">
        <div className="mb-2 flex items-center justify-center gap-[9px]">
          <Logo />
          <span className="font-heading text-[22px] font-bold text-ink">
            ডক্টর<span className="text-brand-600">বন্ধু</span>
          </span>
        </div>
        <p className="mb-1.5 text-center text-sm text-ink-faint">অ্যাডমিন প্যানেলে লগইন করুন</p>
        <p className="mb-[22px] text-center text-xs text-ink-ghost">শুধুমাত্র অনুমোদিত অ্যাডমিনদের জন্য</p>

        <form action={formAction} className="flex flex-col gap-3.5">
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="mb-1.5 block text-[13.5px] font-semibold text-ink-soft">ইমেইল</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="admin@doctorbondhu.com"
              className="w-full rounded-[11px] border border-line px-3.5 py-3 text-[15px] outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13.5px] font-semibold text-ink-soft">পাসওয়ার্ড</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-[11px] border border-line px-3.5 py-3 text-[15px] outline-none focus:border-brand-600"
            />
          </div>
          {result && !result.ok && (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#DC2626]">
              {result.message}
            </div>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-brand-600 p-3.5 text-[15.5px] font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "যাচাই করা হচ্ছে..." : "ড্যাশবোর্ডে লগইন"}
          </button>
        </form>
      </div>
    </div>
  );
}
