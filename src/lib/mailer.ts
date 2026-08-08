import "server-only";
import nodemailer from "nodemailer";
import { unstable_cache } from "next/cache";
import { getEnabledConfig } from "./integrations";
import { getSettings } from "./settings";
import {
  formatSender,
  getVerifiedDomains,
  parseList,
  sendViaResend,
  type Addr,
  type SendArgs,
} from "./resend";

// Provider-agnostic mail layer.
//
// Resend is the primary transport; SMTP stays as the fallback so an account
// still on nodemailer keeps working untouched. Every function here is
// best-effort and never throws — a booking or contact-form submission must
// never fail because mail is misconfigured or the provider is down.
//
// Addresses are the CALLER's decision. Each feature passes its own `to` (and
// `from` when it wants a specific sender), because who receives an email
// depends entirely on the feature: a contact-form confirmation goes to the
// visitor, an appointment mail goes to the patient and to the chamber owner's
// address stored on the doctor record.

export type MailProvider = "resend" | "smtp";

export type MailArgs = Omit<SendArgs, "from" | "to"> & {
  to: Addr;
  /** Defaults to noreply@ on the first verified Resend domain. */
  from?: string;
  fromName?: string;
};

export type MailResult = {
  ok: boolean;
  provider: MailProvider | null;
  id?: string;
  message: string;
};

/** Strips markup so every email carries a plain-text part (helps deliverability). */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Wraps body HTML in a plain, inline-styled shell. Email clients strip <style>
 * blocks and external CSS, so everything here is inline on purpose.
 */
export function emailLayout(title: string, bodyHtml: string, footer?: string): string {
  return `<!doctype html>
<html lang="bn"><body style="margin:0;padding:24px;background:#F4F6F8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1B2733;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;width:100%;background:#FFFFFF;border:1px solid #E4E9EE;border-radius:14px;">
    <tr><td style="padding:24px 26px 8px 26px;">
      <h1 style="margin:0;font-size:17px;line-height:1.5;font-weight:700;color:#1B2733;">${title}</h1>
    </td></tr>
    <tr><td style="padding:4px 26px 24px 26px;font-size:14.5px;line-height:1.75;color:#3C4A57;">
      ${bodyHtml}
    </td></tr>
  </table>
  ${footer ? `<div style="max-width:560px;margin:12px auto 0;font-size:12px;line-height:1.6;color:#8593A0;text-align:center;">${footer}</div>` : ""}
</body></html>`;
}

// The default sender is derived from whatever domain is actually verified in
// Resend, so there is nothing to configure and nothing to keep in sync. Cached
// under the "integrations" tag: saving the integration refreshes it, and normal
// traffic never pays for the extra API call.
const cachedSenderDomain = unstable_cache(
  async (): Promise<string | null> => {
    const cfg = await getEnabledConfig("resend");
    if (!cfg?.api_key) return null;
    const domains = await getVerifiedDomains(cfg);
    return domains?.[0] ?? null;
  },
  ["resend-sender-domain"],
  { tags: ["integrations"], revalidate: 3600 }
);

/** `noreply@<verified domain>`, or null when no domain is verified yet. */
export async function defaultSenderAddress(): Promise<string | null> {
  const domain = await cachedSenderDomain();
  return domain ? `noreply@${domain}` : null;
}

/** Which transport is live right now — Resend wins when both are enabled. */
export async function activeProvider(): Promise<MailProvider | null> {
  const resend = await getEnabledConfig("resend");
  if (resend?.api_key) return "resend";
  const smtp = await getEnabledConfig("smtp");
  if (smtp?.host && smtp?.user) return "smtp";
  return null;
}

async function sendViaSmtp(cfg: Record<string, string>, args: MailArgs): Promise<MailResult> {
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: parseInt(cfg.port || "587", 10),
      secure: cfg.port === "465",
      auth: { user: cfg.user, pass: cfg.pass },
    });
    const info = await transporter.sendMail({
      from: args.from || cfg.from || cfg.user,
      to: args.to,
      cc: args.cc,
      bcc: args.bcc,
      replyTo: args.replyTo,
      subject: args.subject,
      html: args.html,
      text: args.text || htmlToText(args.html),
    });
    return { ok: true, provider: "smtp", id: info.messageId, message: "ইমেইল পাঠানো হয়েছে" };
  } catch (e) {
    return {
      ok: false,
      provider: "smtp",
      message: `SMTP ব্যর্থ: ${e instanceof Error ? e.message : "unknown"}`,
    };
  }
}

/**
 * Sends an email through whichever provider is configured.
 *
 * Resend is tried first; if it is enabled but the send fails, SMTP is used as
 * a backup when it is also configured. Failover only fires on a provider-level
 * error, so a successful Resend send is never duplicated.
 */
export async function sendMail(args: MailArgs): Promise<MailResult> {
  const to = Array.isArray(args.to) ? args.to : parseList(args.to);
  if (!to.length) return { ok: false, provider: null, message: "প্রাপকের ইমেইল নেই" };

  const resendCfg = await getEnabledConfig("resend");
  const smtpCfg = await getEnabledConfig("smtp");
  const smtpReady = Boolean(smtpCfg?.host && smtpCfg?.user);

  if (resendCfg?.api_key) {
    const address = args.from || (await defaultSenderAddress());
    if (!address) {
      return {
        ok: false,
        provider: "resend",
        message: "Resend-এ কোনো ভেরিফাইড ডোমেইন নেই, তাই ইমেইল পাঠানো যাচ্ছে না।",
      };
    }
    const res = await sendViaResend(resendCfg, {
      ...args,
      to,
      from: formatSender(address, args.fromName),
      text: args.text || htmlToText(args.html),
    });
    if (res.ok) return { ok: true, provider: "resend", id: res.id, message: res.message };
    if (!smtpReady) return { ok: false, provider: "resend", message: res.message };
    // Resend is down or misconfigured — fall through to SMTP.
    const fallback = await sendViaSmtp(smtpCfg!, args);
    return fallback.ok
      ? { ...fallback, message: `${fallback.message}। Resend ব্যর্থ হওয়ায় SMTP ব্যবহার হয়েছে।` }
      : { ok: false, provider: "resend", message: `${res.message}; SMTP ফলব্যাকও ব্যর্থ` };
  }

  if (smtpReady) return sendViaSmtp(smtpCfg!, args);

  return { ok: false, provider: null, message: "কোনো ইমেইল প্রোভাইডার চালু নেই" };
}

/**
 * Admin notification for new appointments and leads. Goes to the site contact
 * address from settings, so it needs no separate integration field.
 */
export async function sendNotification(subject: string, html: string): Promise<boolean> {
  const settings = await getSettings();
  const to = parseList(settings.email);
  if (!to.length) return false;
  const res = await sendMail({
    to,
    subject,
    html,
    tags: [{ name: "type", value: "admin_notification" }],
  });
  return res.ok;
}

export async function testSmtp(cfg: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: parseInt(cfg.port || "587", 10),
      secure: cfg.port === "465",
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.verify();
    return { ok: true, message: "SMTP সংযোগ সফল হয়েছে" };
  } catch (e) {
    return { ok: false, message: `সংযোগ ব্যর্থ: ${e instanceof Error ? e.message : "unknown"}` };
  }
}
