"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Check, Copy, Link2, Mail, Trash2 } from "lucide-react";
import { createIntakeLink, discardIntakeLink, sendIntakeLink } from "@/actions/admin-doctor-intake";

// Generate one doctor form link, then either email it or keep it to share by
// hand (WhatsApp, Messenger).
//
// The link row is written when the link is GENERATED, because the URL has to be
// live before it can be shared. From there:
//
//   emailed    the mail is the record; the list stays quiet until the form
//              comes back, and the header only counts it.
//   saved      it shows in the list right away, flagged "জমা পড়েনি", so a link
//              shared by hand can be tracked and re-copied.
//   discarded  the unused token is deleted and the URL stops working.
//
// Closing the modal any other way (the ✕, the backdrop, a browser crash) leaves
// a saved link, never an invisible one — the only way to throw a link away is to
// say so.

/**
 * The sender the doctor sees. Fixed rather than read from site settings: this is
 * the address the business sends client mail from, its domain is what is
 * verified in Resend, and it should not change because someone edited an
 * unrelated contact setting. It is still editable per link in the field below.
 */
const DEFAULT_FROM_EMAIL = "contact@doctorsfindbd.com";

type Created = { id: number; url: string };

const inputCls =
  "w-full rounded-[10px] border border-line bg-white px-[13px] py-[11px] text-[14.5px] outline-none focus:border-brand-600";

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</label>
      {children}
      {hint && <div className="mt-1 text-[11.5px] leading-relaxed text-ink-ghost">{hint}</div>}
    </div>
  );
}

export function GenerateLinkModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [fromEmail, setFromEmail] = useState(DEFAULT_FROM_EMAIL);
  const [toEmail, setToEmail] = useState("");

  const [created, setCreated] = useState<Created | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const generate = () =>
    start(async () => {
      setError(null);
      const res = await createIntakeLink({ client_name: clientName, client_phone: clientPhone });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setCreated({ id: res.id, url: res.url });
    });

  const send = () =>
    start(async () => {
      if (!created) return;
      setError(null);
      const res = await sendIntakeLink({ id: created.id, to_email: toEmail, from_email: fromEmail });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSentTo(toEmail.trim().toLowerCase());
      router.refresh();
    });

  const discard = () =>
    start(async () => {
      if (created) await discardIntakeLink(created.id);
      router.refresh();
      onClose();
    });

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("কপি করা যায়নি। লিংকটি সিলেক্ট করে হাতে কপি করুন।");
    }
  };

  const finish = () => {
    router.refresh();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => !pending && onClose()}
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3 bg-brand-600 px-5 py-4">
          <div>
            <h3 className="mb-0.5 mt-0 font-heading text-[17px] font-bold text-white">ডাক্তার ফর্ম লিংক</h3>
            <p className="mb-0 mt-0 text-[12.5px] leading-relaxed text-brand-100">
              ক্লায়েন্টের নাম ও ফোন দিয়ে একটি লিংক তৈরি করুন। লিংকটি একবারই ব্যবহার করা যাবে।
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="বন্ধ করুন"
            className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {error && (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-[13px] font-semibold text-[#DC2626]">
              {error}
            </div>
          )}

          {sentTo ? (
            <div className="py-3 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white">
                <Check size={26} />
              </div>
              <div className="mb-1 font-heading text-[16px] font-bold text-accent-text">ইমেইল পাঠানো হয়েছে</div>
              <p className="mb-4 mt-0 break-all font-latin text-[13px] text-ink-mute">{sentTo}</p>
              <p className="mb-4 mt-0 text-[13px] leading-relaxed text-ink-faint">
                ক্লায়েন্ট ফর্মটি জমা দিলে এই তালিকায় সব তথ্য চলে আসবে এবং{" "}
                <span className="font-latin">{fromEmail}</span> ঠিকানায় একটি ইমেইলও যাবে। ততক্ষণ পর্যন্ত পাঠানো
                লিংকটি তালিকায় দেখাবে না, উপরে শুধু সংখ্যায় গোনা থাকবে।
              </p>
              <button
                type="button"
                onClick={finish}
                className="rounded-[10px] bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
              >
                ঠিক আছে
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Row label="ক্লায়েন্টের নাম *">
                  <input
                    className={inputCls}
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="আব্দুল করিম"
                    disabled={!!created}
                  />
                </Row>
                <Row label="ক্লায়েন্টের ফোন *">
                  <input
                    className={inputCls + " font-latin"}
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="01712345678"
                    disabled={!!created}
                  />
                </Row>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Row label="প্রেরক ইমেইল (From)" hint="ডোমেইনটি Resend-এ ভেরিফাই থাকতে হবে।">
                  <input
                    className={inputCls + " font-latin"}
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="contact@doctorsfindbd.com"
                  />
                </Row>
                <Row label="প্রাপক ইমেইল (To)" hint="ইমেইলে পাঠাতে চাইলে দিন। হোয়াটসঅ্যাপে পাঠালে খালি রাখুন।">
                  <input
                    className={inputCls + " font-latin"}
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="doctor@example.com"
                  />
                </Row>
              </div>

              {created ? (
                <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-brand-700">
                    <Link2 size={14} /> ফর্মের লিংক
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      readOnly
                      value={created.url}
                      onClick={(e) => e.currentTarget.select()}
                      className="min-w-0 flex-1 rounded-[9px] border border-brand-200 bg-white px-2.5 py-2 font-latin text-[12.5px] text-ink outline-none"
                    />
                    <button
                      type="button"
                      onClick={copy}
                      className="flex shrink-0 items-center gap-1.5 rounded-[9px] border border-brand-600 bg-white px-3 py-2 text-[12.5px] font-bold text-brand-700 hover:bg-brand-50"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? "কপি হয়েছে" : "কপি করুন"}
                    </button>
                  </div>
                  <p className="mb-0 mt-2 text-[11.5px] leading-relaxed text-brand-700">
                    লিংকটি এখনই সক্রিয়। ক্লায়েন্ট একবার ফর্ম জমা দিলে লিংকটি নিজে থেকেই বন্ধ হয়ে যাবে।
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={generate}
                  disabled={pending || !clientName.trim() || !clientPhone.trim()}
                  className="flex items-center justify-center gap-2 rounded-[10px] bg-brand-600 px-5 py-3 text-[15px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  <Link2 size={17} />
                  {pending ? "তৈরি হচ্ছে…" : "লিংক তৈরি করুন"}
                </button>
              )}

              {created && (
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                  <button
                    type="button"
                    onClick={send}
                    disabled={pending || !toEmail.trim()}
                    className="flex items-center justify-center gap-2 rounded-[10px] bg-brand-600 px-5 py-3 text-[15px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    <Mail size={17} />
                    {pending ? "পাঠানো হচ্ছে…" : "ইমেইলে পাঠান"}
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={finish}
                      disabled={pending}
                      className="flex-1 rounded-[10px] border border-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink-mute hover:bg-page disabled:opacity-60"
                    >
                      সংরক্ষণ করে বন্ধ করুন
                    </button>
                    <button
                      type="button"
                      onClick={discard}
                      disabled={pending}
                      className="flex items-center justify-center gap-1.5 rounded-[10px] border border-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-60"
                    >
                      <Trash2 size={15} /> লিংক বাতিল করুন
                    </button>
                  </div>
                  <p className="mb-0 mt-1 text-[11.5px] leading-relaxed text-ink-ghost">
                    সংরক্ষণ করলে লিংকটি তালিকায় &ldquo;জমা পড়েনি&rdquo; চিহ্ন নিয়ে দেখাবে, সেখান থেকে আবার কপি করে
                    হোয়াটসঅ্যাপ বা মেসেঞ্জারে পাঠাতে পারবেন। ক্লায়েন্ট ফর্ম জমা দিলে ওই সারিতেই পুরো তথ্য চলে আসবে।
                    বাতিল করলে লিংকটি আর কাজ করবে না।
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
