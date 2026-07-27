"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { splitLocalePath } from "./i18n";

// Store snapshots of in-flight UI state (form fields, search text, filter
// values) so they survive a language toggle. The [locale] segment is part
// of the URL, so App Router remounts the whole page tree on switch and any
// component-level useState/DOM input value is wiped. These hooks re-hydrate
// the fresh tree from sessionStorage before the user notices anything gone.

const SCROLL_KEY = "__langswitch_scroll";

function makeKey(bucket: string, cleanPath: string, id: string) {
  return `dfb:${bucket}:${cleanPath}:${id}`;
}

// Restore + auto-save uncontrolled form inputs (name attribute → value).
// `formId` scopes storage so two forms on the same page don't collide.
export function usePersistedFormInputs(
  formRef: React.RefObject<HTMLFormElement | null>,
  formId: string,
  { clearOnSuccess }: { clearOnSuccess?: boolean } = {},
) {
  const pathname = usePathname();
  const [, cleanPath] = splitLocalePath(pathname);
  const key = makeKey("form", cleanPath, formId);
  const restoredRef = useRef(false);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    if (!restoredRef.current) {
      restoredRef.current = true;
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
          const saved = JSON.parse(raw) as Record<string, string>;
          for (const [name, value] of Object.entries(saved)) {
            const el = form.elements.namedItem(name) as
              | HTMLInputElement
              | HTMLTextAreaElement
              | null;
            if (!el || typeof value !== "string") continue;
            if (el instanceof HTMLInputElement && (el.type === "hidden" || el.type === "submit")) continue;
            if (el.value === "") el.value = value;
          }
        }
      } catch {}
    }

    const onInput = () => {
      const data: Record<string, string> = {};
      const fd = new FormData(form);
      fd.forEach((v, k) => {
        if (k.startsWith("$")) return; // skip React Server Action fields
        if (typeof v === "string") data[k] = v;
      });
      try {
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch {}
    };
    form.addEventListener("input", onInput);
    return () => form.removeEventListener("input", onInput);
  }, [key, formRef]);

  const clear = () => {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  };

  useEffect(() => {
    if (clearOnSuccess) clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearOnSuccess]);

  return { clear };
}

// Read the last stored value once (for useState initializers). Path-scoped
// so /doctors and /hospitals don't share the same filter state.
export function readPersistedValue(bucket: string, id: string, pathname: string): string | null {
  if (typeof window === "undefined") return null;
  const [, cleanPath] = splitLocalePath(pathname);
  try {
    return sessionStorage.getItem(makeKey(bucket, cleanPath, id));
  } catch {
    return null;
  }
}

export function writePersistedValue(bucket: string, id: string, pathname: string, value: string) {
  if (typeof window === "undefined") return;
  const [, cleanPath] = splitLocalePath(pathname);
  try {
    sessionStorage.setItem(makeKey(bucket, cleanPath, id), value);
  } catch {}
}

// Restore the pre-switch scroll position on mount (or no-op if the stashed
// entry is stale / for a different path). Consumed by a client component
// mounted once in the public layout.
export function useLocaleScrollRestore() {
  const pathname = usePathname();
  const [, cleanPath] = splitLocalePath(pathname);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SCROLL_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as { path: string; y: number; at: number };
      sessionStorage.removeItem(SCROLL_KEY);
      if (snap.path !== cleanPath) return;
      if (Date.now() - snap.at > 4000) return;
      requestAnimationFrame(() => window.scrollTo(0, snap.y));
    } catch {}
  }, [cleanPath]);
}
