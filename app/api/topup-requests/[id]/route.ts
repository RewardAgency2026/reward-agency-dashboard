import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { topup_requests, clients, ad_accounts, suppliers, supplier_sub_accounts, supplier_platform_fees } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { calculateWalletBalance } from "@/lib/balance";
import { logAudit } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({
      id: topup_requests.id,
      client_id: topup_requests.client_id,
      ad_account_id: topup_requests.ad_account_id,
      supplier_id: topup_requests.supplier_id,
      amount: topup_requests.amount,
      currency: topup_requests.currency,
      status: topup_requests.status,
      notes: topup_requests.notes,
      executed_by: topup_requests.executed_by,
      executed_at: topup_requests.executed_at,
      created_at: topup_requests.created_at,
      client_name: clients.name,
      client_code: clients.client_code,
      client_balance_model: clients.balance_model,
      ad_account_platform: ad_accounts.platform,
      ad_account_name: ad_accounts.account_name,
      top_up_fee_rate: ad_accounts.top_up_fee_rate,
      supplier_name: suppliers.name,
      sub_account_name: supplier_sub_accounts.name,
      supplier_fee_rate: supplier_platform_fees.fee_rate,
    })
    .from(topup_requests)
    .leftJoin(clients, eq(topup_requests.client_id, clients.id))
    .leftJoin(ad_accounts, eq(topup_requests.ad_account_id, ad_accounts.id))
    .leftJoin(suppliers, eq(topup_requests.supplier_id, suppliers.id))
    .leftJoin(supplier_sub_accounts, eq(ad_accounts.supplier_sub_account_id, supplier_sub_accounts.id))
    .leftJoin(
      supplier_platform_fees,
      and(
        eq(supplier_platform_fees.supplier_sub_account_id, supplier_sub_accounts.id),
        eq(supplier_platform_fees.platform, ad_accounts.platform)
      )
    )
    .where(eq(topup_requests.id, params.id))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const wallet_balance = await calculateWalletBalance(row.client_id, row.client_balance_model ?? "classic");

  return NextResponse.json({
    ...row,
    executed_at: row.executed_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    wallet_balance,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const [request] = await db
    .select({
      id: topup_requests.id,
      status: topup_requests.status,
      client_id: topup_requests.client_id,
      amount: topup_requests.amount,
      currency: topup_requests.currency,
    })
    .from(topup_requests)
    .where(eq(topup_requests.id, params.id))
    .limit(1);

  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.status === "executed") {
    return NextResponse.json({ error: "Cannot delete an executed top-up request" }, { status: 409 });
  }

  await db.delete(topup_requests).where(eq(topup_requests.id, params.id));

  // Audit log (fire-and-forget)
  db.select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, request.client_id))
    .limit(1)
    .then(([c]) => {
      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? session.user.email ?? "Unknown",
        action: "topup_deleted",
        details: {
          topup_request_id: params.id,
          client_id: request.client_id,
          client_name: c?.name ?? null,
          amount: request.amount,
          currency: request.currency,
          previous_status: request.status,
        },
      });
    })
    .catch(() => {});

  return NextResponse.json({ success: true });
}
