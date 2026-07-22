import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { UsersManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [rowsRes, session] = await Promise.all([
    db.execute<{ id: number; name: string; email: string; role: string; active: boolean; created_at: string }>(
      sql`SELECT id, name, email, role, active, created_at::text FROM admin_users ORDER BY id`
    ),
    getSession(),
  ]);

  return (
    <div>
      <h1 className="mb-5 mt-0 font-heading text-2xl font-bold text-ink">অ্যাডমিন ইউজার</h1>
      <UsersManager rows={rowsRes.rows} isSuperAdmin={session?.role === "super_admin"} selfId={session?.id ?? 0} />
    </div>
  );
}
