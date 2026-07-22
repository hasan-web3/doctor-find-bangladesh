import "server-only";
import { getEnabledConfig } from "./integrations";

// Verify a reCAPTCHA v3 token server-side. When the integration is disabled
// or not configured, the site keeps working (returns true) — rate limiting +
// Zod still guard the forms. Once the admin enables reCAPTCHA and enters
// keys, this verification becomes active on every public form submit.
export async function verifyRecaptcha(token: string | null | undefined): Promise<boolean> {
  const cfg = await getEnabledConfig("recaptcha");
  if (!cfg?.secret_key) return true; // integration off => don't block
  if (!token) return false;
  try {
    const params = new URLSearchParams();
    params.set("secret", cfg.secret_key);
    params.set("response", token);
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success: boolean; score?: number; action?: string };
    if (!data.success) return false;
    // v3 returns a score 0.0 (bot) to 1.0 (human); 0.5 is the standard cutoff.
    if (typeof data.score === "number" && data.score < 0.5) return false;
    return true;
  } catch {
    // Google unreachable: don't wedge legitimate patients; rate limiting still applies.
    return true;
  }
}

// Public site key for the client-side widget (safe to expose).
export async function getRecaptchaSiteKey(): Promise<string | null> {
  const cfg = await getEnabledConfig("recaptcha");
  return cfg?.site_key || null;
}
