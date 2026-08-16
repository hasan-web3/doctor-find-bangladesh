"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { LucideProps } from "lucide-react";

// Escape hatch for a name that is not in ICON_MAP (the icons currently live in
// the database, imported eagerly) but is in the curated picker list, which an
// admin can select at any time without a redeploy.
//
// ONE dynamic import of ONE fixed module. That is the whole design constraint:
// webpack turns a fixed specifier into a single lazy chunk, while an
// interpolated one (`.../${name}.js`) builds a context over every file it could
// possibly match and parks that module map in the runtime chunk every route
// loads — measured at webpack-*.js 3 KB -> 86 KB, shared bundle 102 -> 136 kB.
//
// So the cost model is: nothing until an off-list icon actually renders, then
// one chunk, then cached for the session.

let loaded: Record<string, ComponentType<LucideProps>> | null = null;
let inflight: Promise<void> | null = null;

function loadFullMap(): Promise<void> {
  if (loaded) return Promise.resolve();
  inflight ??= import("./icon-map-full").then((m) => { loaded = m.ICON_MAP_FULL; });
  return inflight;
}

export function LucideLazy({ name, size, className, strokeWidth }: {
  name: string;
  size: number;
  className?: string;
  strokeWidth: number;
}) {
  const [Icon, setIcon] = useState<ComponentType<LucideProps> | null>(
    () => loaded?.[name] ?? null
  );

  useEffect(() => {
    if (loaded?.[name]) { setIcon(() => loaded![name]); return; }
    let live = true;
    loadFullMap()
      .then(() => { if (live && loaded?.[name]) setIcon(() => loaded![name]); })
      // A name in neither map is a stale or mistyped DB value. The caller has
      // already reserved the box, so failing quietly is the right outcome —
      // a decorative icon must never take a page down.
      .catch(() => {});
    return () => { live = false; };
  }, [name]);

  // Reserve the exact box before and after resolution: an icon appearing into
  // zero-width space is a layout shift, and CLS is the one metric on this site
  // that is currently in the green.
  if (!Icon) return <span style={{ width: size, height: size }} className={className} aria-hidden />;
  return <Icon size={size} className={className} strokeWidth={strokeWidth} />;
}
