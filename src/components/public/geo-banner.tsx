"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chooseArea } from "@/actions/public";
import type { Dict } from "@/lib/dict";

type AreaOpt = { slug: string; name: string };

export function GeoBanner({
  areaName,
  areas,
  d,
}: {
  areaName: string | null;
  areas: AreaOpt[];
  d: Pick<Dict, "geo_viewing_from" | "geo_viewing_suffix" | "geo_change" | "geo_pick_area">;
}) {
  const [editing, setEditing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!areaName || dismissed) return null;

  const pick = (slug: string) => {
    startTransition(async () => {
      await chooseArea(slug);
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <div className="border-b border-brand-100 bg-brand-50">
      <div className="mx-auto flex max-w-site flex-wrap items-center justify-center gap-x-3 gap-y-2 px-5 py-2 text-[13.5px] text-brand-700">
        <span>
          <span className="mr-1">◉</span>
          {d.geo_viewing_from} <b>{areaName}</b>
          {d.geo_viewing_suffix}
        </span>
        {editing ? (
          <select
            autoFocus
            disabled={pending}
            defaultValue=""
            onChange={(e) => e.target.value && pick(e.target.value)}
            className="rounded-lg border border-brand-200 bg-white px-2 py-1 text-[13px] text-ink-soft outline-none"
          >
            <option value="" disabled>{d.geo_pick_area}</option>
            {areas.map((a) => (
              <option key={a.slug} value={a.slug}>{a.name}</option>
            ))}
          </select>
        ) : (
          <button onClick={() => setEditing(true)} className="font-bold underline underline-offset-2">
            {d.geo_change}
          </button>
        )}
        <button onClick={() => setDismissed(true)} aria-label="✕" className="text-brand-600">✕</button>
      </div>
    </div>
  );
}
