import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, notifications } from "@/db";
import type { ML } from "@/lib/utils";
import {
  EMPTY_NOTIFICATION_STATE,
  isNotifyPanel,
  type NotificationItem,
  type NotificationState,
  type NotifyPanel,
} from "@/lib/notify-types";

// Writing + reading the admin notification inbox. Read the migration
// (008_notifications.sql) for the "why" behind the source rule.
//
// Every function here is defensive: the dashboard must keep working when the
// notifications table hasn't been migrated yet, so reads fall back to an empty
// state and writes swallow their errors the same way lib/audit.ts does. A
// notification is never worth breaking the mutation that produced it.

export type NotifyInput = {
  /** The /admin panel that owns the new row — where the badge shows up. */
  panel: NotifyPanel;
  /** Machine-readable event name, e.g. "lead.new" or "hospital.quick_create". */
  kind: string;
  title: ML;
  body?: ML;
  entityId?: string | number | null;
  href?: string;
  /**
   * Which panel the write came from. When it matches `panel`, no notification
   * is written — the admin created the row from that panel's own dashboard and
   * is already looking at the list. Use "public" for visitor-facing forms.
   */
  source?: string | null;
};

export async function notify(input: NotifyInput): Promise<void> {
  try {
    if (!isNotifyPanel(input.panel)) return;
    // The whole point of the feature: only tell the panel about changes it
    // couldn't have seen happen.
    if (input.source && input.source === input.panel) return;

    await db.insert(notifications).values({
      panel: input.panel,
      kind: input.kind,
      entityId: input.entityId != null ? String(input.entityId) : null,
      title: input.title,
      body: input.body ?? { bn: "", en: "" },
      href: input.href ?? `/admin/${input.panel}`,
      source: input.source ?? null,
    });
  } catch {
    // Notifications must never break a booking, a lead, or a quick-create.
  }
}

const FEED_LIMIT = 12;

// One round trip per half of the state: the grouped unread counts that drive
// the sidebar badges, and a short recent feed (read included) for the bell.
export async function getNotificationState(limit = FEED_LIMIT): Promise<NotificationState> {
  try {
    const [countRows, itemRows] = await Promise.all([
      db
        .select({ panel: notifications.panel, n: sql<number>`count(*)::int` })
        .from(notifications)
        .where(isNull(notifications.readAt))
        .groupBy(notifications.panel),
      db
        .select({
          id: notifications.id,
          panel: notifications.panel,
          kind: notifications.kind,
          title: notifications.title,
          body: notifications.body,
          href: notifications.href,
          source: notifications.source,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(limit),
    ]);

    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of countRows) {
      counts[row.panel] = row.n;
      total += row.n;
    }

    const items: NotificationItem[] = itemRows.map((r) => ({
      id: r.id,
      panel: r.panel,
      kind: r.kind,
      title: r.title,
      body: r.body,
      href: r.href,
      source: r.source,
      read: r.readAt != null,
      createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
    }));

    return { counts, total, items };
  } catch {
    // Table missing (pre-migration) or DB hiccup — the dashboard still renders.
    return EMPTY_NOTIFICATION_STATE;
  }
}

/** Clears one panel's badge. Called when the admin opens or clicks that panel. */
export async function markPanelRead(panel: string): Promise<void> {
  try {
    if (!isNotifyPanel(panel)) return;
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.panel, panel), isNull(notifications.readAt)));
  } catch {
    // Non-fatal: the badge simply reappears on the next poll.
  }
}

export async function markAllRead(): Promise<void> {
  try {
    await db.update(notifications).set({ readAt: new Date() }).where(isNull(notifications.readAt));
  } catch {
    // Non-fatal.
  }
}
