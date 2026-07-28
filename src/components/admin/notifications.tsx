"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
// Note: no bnNum here on purpose. Counts and timestamps in this feature are
// rendered with ASCII digits ("12", not "১২") while the labels stay Bangla —
// the rest of the admin panel still uses Bangla numerals via lib/bn.
import { cn } from "@/lib/utils";
import {
  EMPTY_NOTIFICATION_STATE,
  isNotifyPanel,
  sourceLabel,
  type NotificationItem,
  type NotificationState,
} from "@/lib/notify-types";
import {
  fetchNotificationState,
  markAllReadAction,
  markPanelReadAction,
} from "@/actions/admin-notifications";

// Admin notification state lives here, shared by the sidebar badges and the
// topbar bell so both agree and only one poller runs.
//
// Why a client provider at all: the admin layout renders the initial state on
// the server, but App Router keeps layouts out of soft navigations — moving
// from /admin/leads to /admin/doctors never re-runs it. So the counts have to
// be refreshable from the client, and clearing a badge has to feel instant
// (optimistic zero first, server confirmation after).

type Ctx = {
  counts: Record<string, number>;
  total: number;
  items: NotificationItem[];
  /** Clear one panel's badge — optimistic, then persisted. */
  markPanel: (panel: string) => void;
  markAll: () => void;
  /** Pull counts now instead of waiting for the next poll. */
  refresh: () => void;
};

// Defaults are no-ops so anything under components/admin still renders if it
// ends up outside the provider.
const NotificationsCtx = createContext<Ctx>({
  ...EMPTY_NOTIFICATION_STATE,
  markPanel: () => {},
  markAll: () => {},
  refresh: () => {},
});

export function useNotifications() {
  return useContext(NotificationsCtx);
}

const POLL_MS = 60_000;

/** Zeroes one panel locally so the badge disappears on the same tick as the click. */
function locallyRead(state: NotificationState, panel: string): NotificationState {
  const cleared = state.counts[panel] ?? 0;
  if (!cleared) return state;
  const counts = { ...state.counts };
  delete counts[panel];
  return {
    counts,
    total: Math.max(0, state.total - cleared),
    items: state.items.map((i) => (i.panel === panel ? { ...i, read: true } : i)),
  };
}

export function NotificationsProvider({
  initial,
  children,
}: {
  initial: NotificationState;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<NotificationState>(initial);
  const pathname = usePathname();

  // Mirror of `state` for the callbacks below: they need to read the current
  // counts to decide whether a server round trip is even needed, and a state
  // updater is the wrong place to do that (it must stay side-effect free).
  const stateRef = useRef(state);
  stateRef.current = state;

  // Fresh server render (hard load or router.refresh) wins over local state.
  useEffect(() => setState(initial), [initial]);

  const refresh = useCallback(async () => {
    try {
      setState(await fetchNotificationState());
    } catch {
      // Offline / expired session — keep showing what we have.
    }
  }, []);

  // Light poll so a lead that arrives while the admin sits on one page still
  // surfaces. Paused while the tab is hidden, and fired once on refocus so
  // coming back to the tab shows current counts immediately.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const markPanel = useCallback((panel: string) => {
    if (!isNotifyPanel(panel)) return;
    // Nothing unread here — don't spend a request clearing zero rows.
    if (!(stateRef.current.counts[panel] ?? 0)) return;
    setState((s) => locallyRead(s, panel));
    markPanelReadAction(panel)
      .then(setState)
      .catch(() => {});
  }, []);

  const markAll = useCallback(() => {
    if (!stateRef.current.total) return;
    setState((s) => ({ counts: {}, total: 0, items: s.items.map((i) => ({ ...i, read: true })) }));
    markAllReadAction()
      .then(setState)
      .catch(() => {});
  }, []);

  // Opening a panel counts as reading it, however the admin got there —
  // sidebar click, bell link, or a pasted URL. Keyed on pathname changes so a
  // notification that lands while they're already sitting on the page keeps its
  // badge until they click the nav item again (otherwise it would vanish before
  // they noticed the list had grown).
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const segment = pathname.split("/")[2] ?? "";
    if (segment) markPanel(segment);
  }, [pathname, markPanel]);

  return (
    <NotificationsCtx.Provider value={{ ...state, markPanel, markAll, refresh }}>
      {children}
    </NotificationsCtx.Provider>
  );
}

// ---------- badge ----------

/** Unread pill for a sidebar row. Renders nothing at zero. */
export function UnreadBadge({ count, active }: { count: number; active?: boolean }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "ml-auto min-w-[21px] rounded-full px-1.5 py-[1px] text-center text-[11px] font-bold leading-[17px]",
        active ? "bg-white text-brand-700" : "bg-[#EF4444] text-white"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ---------- topbar bell ----------

// Bangla relative time with ASCII digits. Only rendered inside the open
// dropdown, so it never participates in hydration.
//
// The older-than-a-week fallback asks for the `latn` numbering system
// explicitly: plain "bn-BD" would format the date in Bangla digits and
// reintroduce exactly what we removed.
const OLD_DATE_FMT = new Intl.DateTimeFormat("bn-BD-u-nu-latn", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function relativeBn(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "এখনই";
  if (mins < 60) return `${mins} মিনিট আগে`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ঘণ্টা আগে`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days} দিন আগে`;
  return OLD_DATE_FMT.format(new Date(iso));
}

export function NotificationBell() {
  const { total, items, markAll, markPanel } = useNotifications();
  const [open, setOpen] = useState(false);

  // Escape closes; the backdrop below handles outside clicks.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={total ? `${total}টি নতুন বিজ্ঞপ্তি` : "বিজ্ঞপ্তি"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-[9px] border border-line bg-white text-ink-mute hover:bg-page"
      >
        <Icon name="bell" size={19} />
        {total > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[#EF4444] px-1 text-center text-[10px] font-bold leading-[18px] text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-11 z-40 w-[330px] overflow-hidden rounded-[12px] border border-line bg-white shadow-[0_12px_32px_rgba(15,23,42,0.16)]">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="text-[13.5px] font-bold text-ink">বিজ্ঞপ্তি</span>
              <span className="text-xs text-ink-ghost">
                {total > 0 ? `${total}টি নতুন` : "সব পড়া হয়েছে"}
              </span>
              {total > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  className="ml-auto text-xs font-semibold text-brand-600 hover:underline"
                >
                  সব পড়া হিসেবে চিহ্নিত করুন
                </button>
              )}
            </div>

            <div className="max-h-[380px] overflow-y-auto">
              {items.length === 0 && (
                <div className="px-4 py-8 text-center text-[13px] text-ink-ghost">
                  এখনো কোনো বিজ্ঞপ্তি নেই।
                </div>
              )}
              {items.map((n) => (
                <Link
                  key={n.id}
                  href={n.href || `/admin/${n.panel}`}
                  onClick={() => {
                    markPanel(n.panel);
                    setOpen(false);
                  }}
                  className={cn(
                    "block border-b border-line/70 px-4 py-3 last:border-b-0 hover:bg-page",
                    !n.read && "bg-[#F0FDFA]"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                    <div className={cn("min-w-0", n.read && "pl-4")}>
                      <div className="truncate text-[13.5px] font-semibold text-ink">
                        {n.title?.bn || n.title?.en || "বিজ্ঞপ্তি"}
                      </div>
                      {(n.body?.bn || n.body?.en) && (
                        <div className="mt-0.5 truncate text-xs text-ink-mute">{n.body.bn || n.body.en}</div>
                      )}
                      {/* Provenance lives only here — the body text must not
                          repeat it. This is the line that answers "why am I
                          being told about this row?". */}
                      <div className="mt-1 text-[11px] text-ink-ghost">
                        {relativeBn(n.createdAt)} · {sourceLabel(n.source).bn} থেকে
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
