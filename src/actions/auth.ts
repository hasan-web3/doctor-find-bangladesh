"use server";

import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

export type LoginResult = { ok: boolean; message: string };

export async function loginAction(_prev: LoginResult | null, formData: FormData): Promise<LoginResult> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`login:${ip}`, 8, 10 * 60_000)) {
    return { ok: false, message: "অনেকবার ভুল চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।" };
  }

  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/admin");

  const user = await login(email, password);
  if (!user) {
    return { ok: false, message: "ইমেইল বা পাসওয়ার্ড সঠিক নয়।" };
  }
  await audit("login", "admin_users", user.id, { email: user.email });
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction() {
  await logout();
  redirect("/admin-login");
}
