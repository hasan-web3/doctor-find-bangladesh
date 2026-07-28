"use server";

import { requireSession } from "@/lib/auth";
import { getNotificationState, markAllRead, markEntityRead, markPanelRead } from "@/lib/notify";
import { EMPTY_NOTIFICATION_STATE, type NotificationState } from "@/lib/notify-types";

// Client entry points for the notification bell / sidebar badges.
//
// The admin layout renders the first state server-side; these actions handle
// everything after that (the layout is cached across soft navigations, so it
// won't re-run on its own). All three require a session — unread counts leak
// how much activity the site gets.

export async function fetchNotificationState(): Promise<NotificationState> {
  try {
    await requireSession();
  } catch {
    // Session expired mid-session: hand back an empty state rather than
    // throwing into the poll loop. The next navigation redirects to login.
    return EMPTY_NOTIFICATION_STATE;
  }
  return getNotificationState();
}

/** The admin opened one specific new row — clear just that one. */
export async function markEntityReadAction(panel: string, entityId: string): Promise<NotificationState> {
  await requireSession();
  await markEntityRead(panel, entityId);
  return getNotificationState();
}

export async function markPanelReadAction(panel: string): Promise<NotificationState> {
  await requireSession();
  await markPanelRead(panel);
  // Return the fresh state so the caller doesn't need a second round trip.
  return getNotificationState();
}

export async function markAllReadAction(): Promise<NotificationState> {
  await requireSession();
  await markAllRead();
  return getNotificationState();
}
