import "server-only";
import { and, desc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
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

// Three reads, in parallel:
//   • grouped unread counts   → sidebar badges
//   • unread entity ids       → which rows a panel's list must highlight
//   • short recent feed       → topbar bell (read items included)
//
// The ids query is unbounded on purpose but self-limiting: a row leaves it the
// moment the admin opens it, so the set only holds what nobody has looked at.
export async function getNotificationState(limit = FEED_LIMIT): Promise<NotificationState> {
  try {
    const [countRows, entityRows, itemRows] = await Promise.all([
      db
        .select({ panel: notifications.panel, n: sql<number>`count(*)::int` })
        .from(notifications)
        .where(isNull(notifications.readAt))
        .groupBy(notifications.panel),
      db
        .select({ panel: notifications.panel, entityId: notifications.entityId })
        .from(notifications)
        .where(and(isNull(notifications.readAt), isNotNull(notifications.entityId))),
      db
        .select({
          id: notifications.id,
          panel: notifications.panel,
          kind: notifications.kind,
          entityId: notifications.entityId,
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

    const unreadEntities: Record<string, string[]> = {};
    for (const row of entityRows) {
      if (!row.entityId) continue;
      (unreadEntities[row.panel] ??= []).push(row.entityId);
    }

    const items: NotificationItem[] = itemRows.map((r) => ({
      id: r.id,
      panel: r.panel,
      kind: r.kind,
      entityId: r.entityId,
      title: r.title,
      body: r.body,
      href: r.href,
      source: r.source,
      read: r.readAt != null,
      createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
    }));

    return { counts, total, items, unreadEntities };
  } catch {
    // Table missing (pre-migration) or DB hiccup — the dashboard still renders.
    return EMPTY_NOTIFICATION_STATE;
  }
}

/**
 * Ids of the rows a panel still has to show as new. Server-side counterpart of
 * `unreadEntities`, used by the list pages to sort unread rows to the top —
 * client-side sorting cannot do that when the list is paginated and the new row
 * sits on page 12.
 *
 * Returns numbers because every panel it serves keys on a bigserial id;
 * anything unparseable is dropped rather than poisoning an `IN (...)`.
 */
export async function getUnreadEntityIds(panel: string): Promise<number[]> {
  try {
    if (!isNotifyPanel(panel)) return [];
    const rows = await db
      .select({ entityId: notifications.entityId })
      .from(notifications)
      .where(and(eq(notifications.panel, panel), isNull(notifications.readAt), isNotNull(notifications.entityId)));
    const ids = rows.map((r) => Number(r.entityId)).filter((n) => Number.isSafeInteger(n) && n > 0);
    return [...new Set(ids)];
  } catch {
    // Never let the badge machinery take a list page down.
    return [];
  }
}

/**
 * ORDER BY fragment that floats a panel's unread rows to the top, for the raw
 * `db.execute(sql\`...\`)` list queries. Returns an empty fragment when nothing
 * is unread, so the normal ordering is untouched.
 *
 * `column` is interpolated raw, so pass a literal like "s.id" — never anything
 * derived from a request. The ids are cast through Number.isSafeInteger in
 * getUnreadEntityIds before they get here.
 */
export function newFirstOrder(column: string, unreadIds: number[]): SQL {
  if (!unreadIds.length) return sql``;
  return sql`(${sql.raw(column)} IN (${sql.raw(unreadIds.join(","))})) DESC,`;
}

/**
 * Marks the notification(s) for ONE row read — the admin opened that row, so
 * it is no longer news. This is the normal path now: opening the panel is not
 * enough, since the whole point is to still see which row was added.
 */
export async function markEntityRead(panel: string, entityId: string | number): Promise<void> {
  try {
    if (!isNotifyPanel(panel)) return;
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.panel, panel),
          eq(notifications.entityId, String(entityId)),
          isNull(notifications.readAt)
        )
      );
  } catch {
    // Non-fatal: the highlight simply returns on the next poll.
  }
}

/** Clears a whole panel at once. Only the bell's "mark all read" uses this now. */
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
