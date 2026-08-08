import "server-only";

// Resend REST client. Deliberately dependency-free (plain fetch) so the
// integration adds no package and works in any Next runtime — the `resend`
// npm SDK is a thin wrapper over these same endpoints.
//
// The integration stores ONLY the API key. Sender and recipient addresses are
// decided by each individual send site (contact form replies to the visitor,
// appointment mails go to the patient and to the chamber owner's address on the
// doctor/chamber record), so there is deliberately no from/to configuration here.

const API_BASE = "https://api.resend.com";
const TIMEOUT_MS = 10_000;

export type Addr = string | string[];
export type ResendConfig = Record<string, string>;

export type SendArgs = {
  /** Full sender header. Must sit on a domain verified in Resend. */
  from: string;
  to: Addr;
  subject: string;
  html: string;
  text?: string;
  cc?: Addr;
  bcc?: Addr;
  replyTo?: Addr;
  /** Resend tags: values are restricted to ASCII letters, digits, _ and -. */
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
};

export type SendResult = { ok: boolean; id?: string; message: string };
export type TestResult = { ok: boolean; message: string };

// Resend error payloads are { statusCode, name, message }.
type ResendDomain = { id: string; name: string; status: string };
type ResendBody = {
  id?: string;
  statusCode?: number;
  name?: string;
  message?: string;
  data?: ResendDomain[];
};

async function call(
  apiKey: string,
  path: string,
  init?: { method: string; body: unknown }
): Promise<{ status: number; body: ResendBody }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init?.method || "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: init ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // Never let an outbound API call settle into a page's ISR entry.
    cache: "no-store",
  });
  let body: ResendBody = {};
  try {
    body = (await res.json()) as ResendBody;
  } catch {
    // 4xx/5xx from an edge proxy can arrive as HTML; leave body empty.
  }
  return { status: res.status, body };
}

/** Splits a comma/semicolon separated recipient string into a clean list. */
export function parseList(raw?: string | null): string[] {
  return (raw || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A non-ASCII display name has to be RFC 2047 encoded before it can travel in
// a header, and Bangla costs 3 UTF-8 bytes per character, so the encoded form
// inflates several times over. Resend rejects the whole address field past 320
// characters: a 47-character Bangla name was enough to trigger
// "The email address length is more than 320 characters long" and silently kill
// every send. 80 bytes is a safe ceiling (~26 Bangla characters, 80 Latin).
const MAX_SENDER_NAME_BYTES = 80;

/**
 * Builds an RFC 5322 address. The display name is quoted so a comma or dot
 * inside a Bangla/Latin brand name can never split the header, and is dropped
 * entirely when it is too long to encode — a plain address still delivers,
 * a rejected header does not.
 */
export function formatSender(email: string, name?: string | null): string {
  const addr = (email || "").trim();
  if (!addr) return "";
  const label = (name || "").trim();
  if (!label || Buffer.byteLength(label, "utf8") > MAX_SENDER_NAME_BYTES) return addr;
  return `${JSON.stringify(label)} <${addr}>`;
}

function cleanTags(tags?: { name: string; value: string }[]) {
  if (!tags?.length) return undefined;
  const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);
  return tags.map((t) => ({ name: safe(t.name), value: safe(t.value) }));
}

/**
 * Sends one email. Never throws — callers treat mail as best-effort so a
 * provider outage can never fail a booking or a contact-form submission.
 */
export async function sendViaResend(cfg: ResendConfig, args: SendArgs): Promise<SendResult> {
  const apiKey = (cfg.api_key || "").trim();
  const to = Array.isArray(args.to) ? args.to : parseList(args.to);

  if (!apiKey) return { ok: false, message: "Resend API কী নেই" };
  if (!args.from) return { ok: false, message: "প্রেরক ইমেইল নেই" };
  if (!to.length) return { ok: false, message: "প্রাপকের ইমেইল নেই" };

  // Only send keys that have a value — Resend rejects explicit nulls.
  const payload: Record<string, unknown> = {
    from: args.from,
    to,
    subject: args.subject,
    html: args.html,
  };
  if (args.text) payload.text = args.text;
  if (args.cc) payload.cc = args.cc;
  if (args.bcc) payload.bcc = args.bcc;
  if (args.replyTo && (Array.isArray(args.replyTo) ? args.replyTo.length : args.replyTo)) {
    payload.reply_to = args.replyTo;
  }
  const tags = cleanTags(args.tags);
  if (tags) payload.tags = tags;
  if (args.headers) payload.headers = args.headers;

  try {
    const { status, body } = await call(apiKey, "/emails", { method: "POST", body: payload });
    if (status >= 200 && status < 300 && body.id) {
      return { ok: true, id: body.id, message: "ইমেইল পাঠানো হয়েছে" };
    }
    return { ok: false, message: explain(status, body) };
  } catch (e) {
    const reason = e instanceof Error && e.name === "TimeoutError" ? "সময় শেষ" : "নেটওয়ার্ক সমস্যা";
    return { ok: false, message: `Resend-এ পৌঁছানো যায়নি: ${reason}` };
  }
}

/** Maps a Resend error payload onto an admin-readable Bangla message. */
function explain(status: number, body: ResendBody): string {
  const detail = body.message ? `: ${body.message}` : "";

  // Verified against the live API: a bad key does NOT return the documented
  // 403 `invalid_api_key`. It returns 400 with name `validation_error` and
  // message "API key is invalid", which would otherwise surface as a generic
  // "validation failed" and send the admin looking in the wrong place.
  if (/api key is invalid/i.test(body.message || "")) {
    return "API কী সঠিক নয়। Resend ড্যাশবোর্ড থেকে নতুন কী নিন।";
  }

  switch (body.name) {
    case "missing_api_key":
      return "API কী পাঠানো হয়নি";
    case "invalid_api_key":
      return "API কী সঠিক নয়। Resend ড্যাশবোর্ড থেকে নতুন কী নিন।";
    case "restricted_api_key":
      return "এই API কী শুধু ইমেইল পাঠানোর অনুমতি পেয়েছে";
    case "validation_error":
      return `তথ্য যাচাই ব্যর্থ${detail}`;
    case "rate_limit_exceeded":
      return "একসাথে অনেক অনুরোধ গেছে, একটু পরে চেষ্টা করুন";
    case "daily_quota_exceeded":
      return "আজকের ইমেইল কোটা শেষ";
    case "monthly_quota_exceeded":
      return "এই মাসের ইমেইল কোটা শেষ";
    default:
      return `Resend ব্যর্থ (HTTP ${status})${detail}`;
  }
}

/**
 * Verified sending domains on the account, newest-listed first. Returns null
 * when the key cannot read them (a sending-only key), which is different from
 * an empty array (readable, but nothing verified).
 */
export async function getVerifiedDomains(cfg: ResendConfig): Promise<string[] | null> {
  const apiKey = (cfg.api_key || "").trim();
  if (!apiKey) return null;
  try {
    const { status, body } = await call(apiKey, "/domains?limit=100");
    if (status < 200 || status >= 300) return null;
    return (body.data || [])
      .filter((d) => d.status === "verified" && d.name)
      .map((d) => d.name.toLowerCase());
  } catch {
    return null;
  }
}

/**
 * Validates the API key without sending anything, and reports which domains
 * are ready to send from. Each send site picks its own sender address later,
 * so this only has to answer: is the key good, and can we send from anywhere?
 */
export async function testResend(cfg: ResendConfig): Promise<TestResult> {
  const apiKey = (cfg.api_key || "").trim();

  if (!apiKey) return { ok: false, message: "Resend API কী দিন" };
  if (!apiKey.startsWith("re_")) {
    return { ok: false, message: "API কী সঠিক নয়। Resend কী re_ দিয়ে শুরু হয়।" };
  }

  let status: number;
  let body: ResendBody;
  try {
    ({ status, body } = await call(apiKey, "/domains?limit=100"));
  } catch (e) {
    const reason = e instanceof Error && e.name === "TimeoutError" ? "সময় শেষ" : "নেটওয়ার্ক সমস্যা";
    return { ok: false, message: `Resend-এ পৌঁছানো যায়নি: ${reason}` };
  }

  // A sending-only key is valid but cannot list domains. Accept it and say so.
  if (body.name === "restricted_api_key") {
    return { ok: true, message: "API কী সঠিক। এই কী শুধু ইমেইল পাঠাতে পারে, তাই ডোমেইন দেখা যায়নি।" };
  }
  if (status < 200 || status >= 300) {
    return { ok: false, message: explain(status, body) };
  }

  const all = body.data || [];
  const verified = all.filter((d) => d.status === "verified").map((d) => d.name);

  if (verified.length) {
    return { ok: true, message: `সংযোগ সফল। পাঠানোর জন্য প্রস্তুত: ${verified.join(", ")}` };
  }
  if (all.length) {
    const pending = all.map((d) => `${d.name} (${d.status})`).join(", ");
    return { ok: false, message: `API কী সঠিক, কিন্তু কোনো ডোমেইন ভেরিফাই হয়নি। ${pending}` };
  }
  return { ok: false, message: "API কী সঠিক, কিন্তু Resend-এ কোনো ডোমেইন যোগ করা নেই।" };
}
