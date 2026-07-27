"use client";

// Modern search bar for admin dashboards: types instantly, updates the URL
// (?q=...) after a short pause of inactivity, and lets Enter submit right
// away. The server pages read `q` and use the shared SQL helper in
// src/lib/admin-search.ts, which does bilingual bn+en ILIKE plus pg_trgm
// word_similarity so typos ("kalder" → "khalder") still surface results.

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type Props = {
  initial: string;
  placeholder?: string;
  paramName?: string;
  debounceMs?: number;
  minChars?: number;
  className?: string;
};

export function DebouncedSearch({
  initial,
  placeholder = "খুঁজুন / Search",
  paramName = "q",
  debounceMs = 500,
  minChars = 1,
  className = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushed = useRef(initial);

  // Keep local input in sync when the URL is changed elsewhere (e.g. clearing
  // filters via a Link). Skip when the change came from our own push.
  useEffect(() => {
    const urlVal = params.get(paramName) ?? "";
    if (urlVal !== lastPushed.current) {
      setValue(urlVal);
      lastPushed.current = urlVal;
    }
  }, [params, paramName]);

  const push = (next: string) => {
    if (next === lastPushed.current) return;
    lastPushed.current = next;
    const sp = new URLSearchParams(params.toString());
    if (next) sp.set(paramName, next);
    else sp.delete(paramName);
    sp.delete("page");
    const qs = sp.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  };

  const schedule = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    const trimmed = next.trim();
    if (trimmed && trimmed.length < minChars) return;
    timer.current = setTimeout(() => push(trimmed), debounceMs);
  };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    setValue("");
    push("");
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        push(value.trim());
      }}
      className={`flex min-w-[220px] max-w-[380px] flex-1 items-center gap-2 rounded-[10px] border border-line bg-white px-3 ${className}`}
    >
      <span className={`text-ink-ghost transition-opacity ${pending ? "animate-pulse opacity-70" : ""}`} aria-hidden>
        {pending ? "…" : "⌕"}
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => { setValue(e.target.value); schedule(e.target.value); }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 border-none bg-transparent py-2.5 text-sm outline-none"
        autoComplete="off"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear"
          className="rounded-md p-1 text-ink-ghost hover:bg-page hover:text-ink"
        >
          ✕
        </button>
      )}
    </form>
  );
}
