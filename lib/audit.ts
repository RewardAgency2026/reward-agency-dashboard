import { db } from "@/db";
import { audit_logs } from "@/db/schema";

export type AuditAction =
  | "topup_executed"
  | "topup_rejected"
  | "topup_deleted"
  | "balance_credited"
  | "balance_withdrawn"
  | "client_created"
  | "client_updated"
  | "supplier_created"
  | "supplier_updated";

export async function logAudit(params: {
  userId: string;
  userName: string;
  action: AuditAction;
  details: Record<string, unknown>;
}) {
  await db.insert(audit_logs).values({
    user_id: params.userId,
    user_name: params.userName,
    action: params.action,
    details: params.details,
  }).catch(() => {}); // fire-and-forget, never block the main response
}
