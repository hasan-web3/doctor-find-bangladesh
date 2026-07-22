"use client";

import { useActionState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { submitLead, type FormResult } from "@/actions/public";
import type { Dict } from "@/lib/dict";

export function LeadForm({
  type,
  d,
  namePlaceholder,
  messagePlaceholder,
  submitLabel,
  extraField,
}: {
  type: "patient" | "doctor";
  d: Pick<Dict, "your_name" | "your_message" | "send" | "sending" | "mobile_number">;
  namePlaceholder?: string;
  messagePlaceholder?: string;
  submitLabel?: string;
  extraField?: { name: string; placeholder: string };
}) {
  const [result, formAction, pending] = useActionState<FormResult | null, FormData>(submitLead, null);
  const [parent] = useAutoAnimate();

  if (result?.ok) {
    return (
      <div ref={parent}>
        <div className="rounded-2xl border border-[#86EFAC] bg-accent-soft p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-2xl text-white">✓</div>
          <div className="font-heading text-lg font-bold text-accent-text">{result.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={parent}>
      <form action={formAction} className="flex flex-col gap-3.5">
      <input type="hidden" name="type" value={type} />
      <input
        name="name"
        required
        placeholder={namePlaceholder || d.your_name}
        className="w-full rounded-[11px] border border-line px-3.5 py-3 text-[15px] outline-none focus:border-brand-600"
      />
      <div className={extraField ? "grid grid-cols-1 gap-3.5 sm:grid-cols-2" : ""}>
        <input
          name="phone"
          required
          placeholder={d.mobile_number}
          className="w-full rounded-[11px] border border-line px-3.5 py-3 text-[15px] outline-none focus:border-brand-600"
        />
        {extraField && (
          <input
            name="extra"
            placeholder={extraField.placeholder}
            className="w-full rounded-[11px] border border-line px-3.5 py-3 text-[15px] outline-none focus:border-brand-600"
          />
        )}
      </div>
      <textarea
        name="message"
        rows={3}
        placeholder={messagePlaceholder || d.your_message}
        className="w-full resize-y rounded-[11px] border border-line px-3.5 py-3 font-body text-[15px] outline-none focus:border-brand-600"
      />
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
        {pending ? d.sending : submitLabel || d.send}
      </button>
    </form>
    </div>
  );
}
