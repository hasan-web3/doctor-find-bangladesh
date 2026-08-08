"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "@/actions/admin-system";
import { Field, inputCls, Toast } from "@/components/admin/ui";

// Where contact-form submissions are delivered. Lives on this page rather than
// in general settings because it only governs this inbox.
export function ContactEmailSettings({
  initialFrom,
  initialBcc,
}: {
  initialFrom: string;
  initialBcc: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [from, setFrom] = useState(initialFrom);
  const [bcc, setBcc] = useState(initialBcc);
  const [open, setOpen] = useState(false);

  const save = () =>
    startTransition(async () => {
      const res = await saveSettings({
        contact_email_from: from.trim(),
        contact_email_bcc: bcc.trim(),
      });
      setResult(res);
      router.refresh();
    });

  return (
    <div className="mb-[18px] rounded-2xl border border-line bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-center gap-3 p-5 text-left"
      >
        <div className="min-w-[200px] flex-1">
          <div className="font-heading text-[15px] font-bold text-ink">ইমেইল সেটিংস</div>
          <div className="mt-0.5 text-[13px] text-ink-faint">
            যোগাযোগ ফর্মের কনফার্মেশন ইমেইল কোথা থেকে যাবে ও কারা কপি পাবেন তা ঠিক করুন।
          </div>
        </div>
        <span className="text-ink-ghost">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-line p-5">
          <Toast result={result} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="প্রেরক ইমেইল (From)" hint="এই ঠিকানা থেকে কনফার্মেশন যাবে। ডোমেইনটি Resend-এ ভেরিফাই থাকতে হবে।">
              <input
                className={inputCls + " font-latin"}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="contact@doctorsfindbd.com"
              />
            </Field>
            <Field label="অতিরিক্ত প্রাপক (BCC)" hint="একাধিক হলে কমা দিয়ে লিখুন। ভিজিটর ইমেইল না দিলে শুধু এরাই কপি পাবেন।">
              <input
                className={inputCls + " font-latin"}
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="team@doctorsfindbd.com, manager@doctorsfindbd.com"
              />
            </Field>
          </div>
          <button
            onClick={save}
            disabled={pending}
            className="mt-4 rounded-[10px] bg-brand-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      )}
    </div>
  );
}
