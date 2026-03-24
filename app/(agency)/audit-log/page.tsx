import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { audit_logs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { AuditLogTable } from "@/components/audit-log/audit-log-table";

export default async function AuditLogPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const logs = await db
    .select()
    .from(audit_logs)
    .orderBy(desc(audit_logs.created_at))
    .limit(500);

  const rows = logs.map((l) => ({
    id: l.id,
    user_name: l.user_name,
    action: l.action,
    details: l.details as Record<string, unknown>,
    created_at: l.created_at.toISOString(),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">All sensitive actions tracked in real-time</p>
      </div>
      <AuditLogTable logs={rows} />
    </div>
  );
}
