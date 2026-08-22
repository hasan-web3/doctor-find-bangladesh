"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { exportCard, type Ctx } from "@/lib/tools/share-card";
import { cn } from "@/lib/utils";

export type CardSpec = {
  width: number;
  height: number;
  filename: string;
  draw: (ctx: Ctx, width: number, height: number) => void | Promise<void>;
};

/**
 * "Save this result as a picture."
 *
 * Generic on purpose — it knows nothing about which calculator produced the
 * card, so the next tool that wants one supplies its own artwork and reuses all
 * of this.
 *
 * The spec arrives as a FACTORY rather than as plain props. Card height depends
 * on measured text, which needs a canvas, which needs `document` — calling that
 * during render would crash the server pass. Deferring it to the click keeps
 * the component safe to server-render.
 *
 * The button locks while rendering: encoding a tall PNG takes a beat on a
 * low-end phone, and without the lock an impatient double-tap starts two
 * downloads.
 */
export function ShareCardButton({
  label,
  busyLabel,
  errorLabel,
  doneLabel,
  card,
  className,
}: {
  label: string;
  busyLabel: string;
  errorLabel: string;
  doneLabel: string;
  card: () => CardSpec;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  const run = async () => {
    if (state === "busy") return;
    setState("busy");
    try {
      await exportCard(card());
      setState("done");
      setTimeout(() => setState("idle"), 2600);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3200);
    }
  };

  const text =
    state === "busy" ? busyLabel : state === "done" ? doneLabel : state === "error" ? errorLabel : label;

  return (
    <button
      type="button"
      onClick={run}
      disabled={state === "busy"}
      aria-live="polite"
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14.5px] font-bold transition-all duration-150 active:scale-[0.99]",
        state === "error"
          ? "bg-[#FEF2F2] text-[#B91C1C] ring-1 ring-[#FECACA]"
          : state === "done"
            ? "bg-accent-soft text-accent-text ring-1 ring-[#A7F3D0]"
            : "bg-brand-700 text-white hover:bg-brand-900",
        state === "busy" && "cursor-wait opacity-70",
        className,
      )}
    >
      <Icon
        name={state === "done" ? "shield" : state === "error" ? "cross" : "chart"}
        size={18}
        className={state === "busy" ? "animate-pulse" : undefined}
      />
      {text}
    </button>
  );
}
