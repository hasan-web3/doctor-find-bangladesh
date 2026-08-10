"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFaqEnabled } from "@/actions/admin-content";
import { Toggle, Toast } from "@/components/admin/ui";

// The on/off switch for an FAQ block, used at both levels:
//   refId === null -> the whole scope ("every district's FAQ")
//   refId set      -> one entity ("Khulna's FAQ")
//
// Off hides the block completely on the public page, generated and
// hand-written alike, and nothing is deleted. Turning it back on restores
// exactly what was there before, which is why this is a switch rather than a
// bulk delete.
export function FaqToggle({
  scope,
  refId = null,
  initialEnabled,
  label,
  hint,
  /** True when the whole scope is off, which overrides this entity's own switch. */
  scopeOff = false,
}: {
  scope: string;
  refId?: number | null;
  initialEnabled: boolean;
  label: string;
  hint?: string;
  scopeOff?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const change = (next: boolean) => {
    // Optimistic: the switch answers immediately and rolls back if the write
    // fails, rather than sitting still for a round trip.
    setEnabled(next);
    startTransition(async () => {
      const res = await setFaqEnabled({ scope, ref_id: refId, enabled: next });
      setResult(res);
      if (!res.ok) setEnabled(!next);
      router.refresh();
    });
  };

  return (
    <div
      className={`mb-4 rounded-[14px] border p-4 ${
        enabled && !scopeOff ? "border-line bg-white" : "border-amber-200 bg-amber-50/60"
      }`}
    >
      <Toast result={result} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[200px]">
          <div className="text-[14.5px] font-semibold text-ink">{label}</div>
          {hint && <div className="mt-0.5 text-[12.5px] text-ink-faint">{hint}</div>}
          {scopeOff && (
            <div className="mt-1 text-[12.5px] font-semibold text-amber-700">
              পুরো স্কোপের FAQ বন্ধ আছে, তাই এই সুইচ চালু থাকলেও পেজে FAQ দেখাবে না।
            </div>
          )}
        </div>
        <div className={pending ? "opacity-60" : ""}>
          <Toggle checked={enabled} onChange={change} label={enabled ? "চালু" : "বন্ধ"} />
        </div>
      </div>
    </div>
  );
}
