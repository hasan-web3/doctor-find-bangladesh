// Shared notification types + the panel whitelist.
//
// Deliberately free of any `server-only` import so the sidebar, the bell, and
// the client provider can all share these shapes with lib/notify.ts. Same split
// as seo.ts (server) vs seo-utils.ts (shared) — do not merge them back.

import type { ML } from "@/lib/utils";

// The /admin route segments that can receive notifications. Anything outside
// this list is dropped by notify(), so a typo can never create a badge that no
// page is able to clear (the sidebar clears by segment).
export const NOTIFY_PANELS = [
  "appointments",
  "leads",
  "hospitals",
  "specialties",
  "districts",
  "areas",
] as const;

export type NotifyPanel = (typeof NOTIFY_PANELS)[number];

export function isNotifyPanel(value: string): value is NotifyPanel {
  return (NOTIFY_PANELS as readonly string[]).includes(value);
}

export type NotificationItem = {
  id: number;
  panel: string;
  kind: string;
  /** Id of the row this is about, as a string. Null for events with no row. */
  entityId: string | null;
  title: ML;
  body: ML;
  href: string | null;
  source: string | null;
  read: boolean;
  createdAt: string;
};

export type NotificationState = {
  /** Unread count keyed by panel segment. Panels with zero are omitted. */
  counts: Record<string, number>;
  total: number;
  /** Most recent notifications (read and unread) for the topbar bell. */
  items: NotificationItem[];
  /**
   * Unread entity ids keyed by panel, as strings. This is what lets a panel's
   * list highlight exactly which rows are new and clear them one at a time —
   * the count is a consequence of these, not the other way round.
   */
  unreadEntities: Record<string, string[]>;
};

export const EMPTY_NOTIFICATION_STATE: NotificationState = {
  counts: {},
  total: 0,
  items: [],
  unreadEntities: {},
};

// Bangla-first label for a notification's origin panel, used in the bell body
// text ("ডাক্তার ফর্ম থেকে যোগ করা হয়েছে"). `public` covers the visitor-facing
// forms, which have no admin panel of their own.
export const SOURCE_LABELS: Record<string, ML> = {
  public: { bn: "ওয়েবসাইট", en: "website" },
  doctors: { bn: "ডাক্তার ফর্ম", en: "doctor form" },
  hospitals: { bn: "হাসপাতাল ফর্ম", en: "hospital form" },
  specialties: { bn: "বিভাগ ফর্ম", en: "specialty form" },
  districts: { bn: "জেলা ফর্ম", en: "district form" },
  areas: { bn: "শহর / গ্রাম ফর্ম", en: "area form" },
};

export function sourceLabel(source?: string | null): ML {
  return SOURCE_LABELS[source ?? ""] ?? { bn: "ড্যাশবোর্ড", en: "dashboard" };
}
