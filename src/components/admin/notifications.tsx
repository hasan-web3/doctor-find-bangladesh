"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  markEntityReadAction,
  markPanelReadAction,
} from "@/actions/admin-notifications";

// Admin notification state lives here, shared by the sidebar badges, the topbar
// bell, and every panel list that highlights its new rows — so all three agree
// and only one poller runs.
//
// Why a client provider at all: the admin layout renders the initial state on
// the server, but App Router keeps layouts out of soft navigations — moving
// from /admin/leads to /admin/doctors never re-runs it. So the state has to be
// refreshable from the client, and clearing a badge has to feel instant
// (optimistic update first, server confirmation after).
//
// Read semantics: opening a panel does NOT clear its badge. The badge is what
// sends the admin looking, and the highlighted row is what they are looking
// for — clearing on arrival would erase the answer along with the question.
// A notification dies when its own row is opened (markEntity), or wholesale
// from the bell's "mark all read".

type Ctx = {
  counts: Record<string, number>;
  total: number;
  items: NotificationItem[];
  unreadEntities: Record<string, string[]>;
  /** The admin opened one new row — clear just that row's notification. */
  markEntity: (panel: string, entityId: string | number) => void;
  /** Clear a whole panel at once. Only the bell uses this. */
  markPanel: (panel: string) => void;
  markAll: () => void;
  /** Pull state now instead of waiting for the next poll. */
  refresh: () => void;
};

// Defaults are no-ops so anything under components/admin still renders if it
// ends up outside the provider.
const NotificationsCtx = createContext<Ctx>({
  ...EMPTY_NOTIFICATION_STATE,
  markEntity: () => {},
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
  const unreadEntities = { ...state.unreadEntities };
  delete unreadEntities[panel];
  return {
    counts,
    total: Math.max(0, state.total - cleared),
    items: state.items.map((i) => (i.panel === panel ? { ...i, read: true } : i)),
    unreadEntities,
  };
}

/**
 * Drops one row from a panel's unread set. The count is derived from the ids
 * so both move together — the badge and the row highlight must never disagree.
 */
function locallyReadEntity(state: NotificationState, panel: string, entityId: string): NotificationState {
  const ids = state.unreadEntities[panel] ?? [];
  if (!ids.includes(entityId)) return state;
  const remaining = ids.filter((id) => id !== entityId);

  const unreadEntities = { ...state.unreadEntities };
  if (remaining.length) unreadEntities[panel] = remaining;
  else delete unreadEntities[panel];

  // One id can carry more than one notification (added, then edited elsewhere),
  // so shrink the count by however many rows actually matched.
  const hit = state.items.filter((i) => i.panel === panel && i.entityId === entityId && !i.read).length;
  const dropped = Math.max(1, hit);
  const counts = { ...state.counts };
  const left = (counts[panel] ?? 0) - dropped;
  if (left > 0) counts[panel] = left;
  else delete counts[panel];

  return {
    counts,
    total: Math.max(0, state.total - dropped),
    items: state.items.map((i) =>
      i.panel === panel && i.entityId === entityId ? { ...i, read: true } : i
    ),
    unreadEntities,
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

  const markEntity = useCallback((panel: string, entityId: string | number) => {
    if (!isNotifyPanel(panel)) return;
    const id = String(entityId);
    // Not flagged as new — nothing to clear, so no request.
    if (!(stateRef.current.unreadEntities[panel] ?? []).includes(id)) return;
    setState((s) => locallyReadEntity(s, panel, id));
    markEntityReadAction(panel, id)
      .then(setState)
      .catch(() => {});
  }, []);

  const markAll = useCallback(() => {
    if (!stateRef.current.total) return;
    setState((s) => ({
      counts: {},
      total: 0,
      items: s.items.map((i) => ({ ...i, read: true })),
      unreadEntities: {},
    }));
    markAllReadAction()
      .then(setState)
      .catch(() => {});
  }, []);

  // Note: there is deliberately no "mark read on navigation" effect. Opening
  // /admin/specialties must leave the badge and the row highlight intact —
  // they are the whole point of walking over there.

  return (
    <NotificationsCtx.Provider value={{ ...state, markEntity, markPanel, markAll, refresh }}>
      {children}
    </NotificationsCtx.Provider>
  );
}

// ---------- what a panel's list needs ----------

/**
 * Everything a list page needs to surface its new rows: which ids are new, how
 * to clear one, and an ordering that floats them to the top.
 *
 * The server already orders unread rows first (see the panel page queries) —
 * `newFirst` re-applies it on the client so the order stays put after a
 * router.refresh() and while an optimistic clear is in flight.
 */
export function useNewRows(panel: string) {
  const { unreadEntities, markEntity } = useNotifications();
  const ids = useMemo(() => new Set(unreadEntities[panel] ?? []), [unreadEntities, panel]);

  return useMemo(
    () => ({
      count: ids.size,
      isNew: (id: number | string) => ids.has(String(id)),
      markRead: (id: number | string) => markEntity(panel, id),
      newFirst: <T extends { id: number | string }>(rows: T[]): T[] =>
        ids.size
          ? // Array.sort is stable, so rows that are equally new/old keep the
            // order the server gave them.
            [...rows].sort(
              (a, b) => Number(ids.has(String(b.id))) - Number(ids.has(String(a.id)))
            )
          : rows,
    }),
    [ids, markEntity, panel]
  );
}

/** Row styling for a newly-arrived row. Brand teal so it reads as "ours". */
export const NEW_ROW_CLASS = "bg-brand-100";

/** Little "নতুন" flag rendered next to a new row's name. */
export function NewFlag() {
  return (
    <span className="rounded-full bg-brand-600 px-2 py-[2px] text-[10.5px] font-bold text-white">
      নতুন
    </span>
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
  const { total, items, markAll } = useNotifications();
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
                  // Jump to the panel but leave the notification unread, so the
                  // row is still highlighted when the admin lands there. Only
                  // "mark all read" above clears from the bell.
                  onClick={() => setOpen(false)}
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
