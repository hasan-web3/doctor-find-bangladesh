"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveToolToggles } from "@/actions/admin-system";
import { Icon } from "@/components/icons";
import { StatusBadge, Toast, Toggle } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export type ToolRow = {
  key: string;
  slug: string;
  name: string;
  nameEn: string;
  tagline: string;
  source: string;
  icon: string;
  bg: string;
  fg: string;
  status: "live" | "planned";
  enabled: boolean;
  lockedReason: string | null;
};

export function ToolsManager({ rows }: { rows: ToolRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(rows.map((r) => [r.key, r.enabled])),
  );

  const liveCount = rows.filter((r) => r.status === "live" && state[r.key]).length;

  const save = () =>
    startTransition(async () => {
      const res = await saveToolToggles(state);
      setResult(res);
      router.refresh();
    });

  const dirty = rows.some((r) => state[r.key] !== r.enabled);

  return (
    <div className="flex flex-col gap-4">
      <Toast result={result} />

      {/* Turning everything off is allowed — an admin may want the section gone
          during an audit — but it is a bigger action than it looks, so it says
          so plainly instead of silently 404ing the hub. */}
      {liveCount === 0 && (
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-semibold text-[#B91C1C]">
          সব টুল বন্ধ আছে। সংরক্ষণ করলে মেনু থেকে &ldquo;টুলস&rdquo; সরে যাবে এবং /tools পেজটি আর খুলবে না।
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const locked = row.status === "planned";
          const on = !!state[row.key];
          return (
            <div
              key={row.key}
              className={cn(
                "flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center",
                locked ? "border-dashed border-line opacity-70" : "border-line",
              )}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: row.bg, color: row.fg }}
                aria-hidden
              >
                <Icon name={row.icon} size={22} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold text-ink">{row.name}</span>
                  {/* English name and slug stay in Latin: an operator
                      cross-checking a URL needs the characters that are
                      actually in it. */}
                  <span className="font-latin text-[12px] text-ink-ghost">/tools/{row.slug}</span>
                  {locked && <StatusBadge tone="gray">{row.lockedReason}</StatusBadge>}
                </div>
                <p className="mb-0 mt-1 text-[13px] leading-relaxed text-ink-mute">{row.tagline}</p>
                <p className="mb-0 mt-1 text-[11.5px] leading-relaxed text-ink-ghost">{row.source}</p>
              </div>

              <div className="shrink-0 sm:pl-3">
                {locked ? (
                  <span className="text-[12.5px] font-semibold text-ink-ghost">—</span>
                ) : (
                  // The state word IS the switch's label rather than a
                  // separate badge: an unlabelled role="switch" has no
                  // accessible name, and a badge saying the same thing two
                  // inches away does not give it one.
                  <Toggle
                    checked={on}
                    onChange={(v) => setState((s) => ({ ...s, [row.key]: v }))}
                    label={on ? "চালু" : "বন্ধ"}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className={cn(
            "rounded-[10px] px-5 py-2.5 text-sm font-bold text-white transition-colors",
            pending || !dirty ? "cursor-not-allowed bg-ink-ghost" : "bg-brand-600 hover:bg-brand-700",
          )}
        >
          {pending ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
        </button>
        {dirty && !pending && (
          <span className="text-[13px] font-semibold text-warm-text">অসংরক্ষিত পরিবর্তন আছে</span>
        )}
      </div>

      <p className="mb-0 mt-1 text-[12.5px] leading-relaxed text-ink-ghost">
        সংরক্ষণ করলে পুরো সাইটের ক্যাশ ও sitemap নতুন করে তৈরি হয়, কারণ মেনু প্রতিটি পেজে আছে।
        এটি কয়েক সেকেন্ড সময় নিতে পারে।
      </p>
    </div>
  );
}
