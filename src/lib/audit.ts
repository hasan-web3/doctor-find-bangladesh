import "server-only";
import { db, auditLog } from "@/db";
import { getSession } from "./auth";

export async function audit(
  action: string,
  entity: string,
  entityId?: string | number | null,
  details: Record<string, unknown> = {}
) {
  try {
    const session = await getSession();
    await db.insert(auditLog).values({
      actorId: session?.id ?? null,
      actorName: session?.name ?? "system",
      action,
      entity,
      entityId: entityId != null ? String(entityId) : null,
      details,
    });
  } catch {
    // Audit logging must never break a mutation.
  }
}
