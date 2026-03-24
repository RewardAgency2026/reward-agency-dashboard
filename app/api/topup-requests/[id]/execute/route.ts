import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { topup_requests, clients, ad_accounts, supplier_platform_fees, transactions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { calculateWalletBalance } from "@/lib/balance";
import { logAudit } from "@/lib/audit";

const executeSchema = z.object({
  force: z.boolean().optional().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "team"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const parsed = executeSchema.safeParse(body);
  const force = parsed.success ? parsed.data.force : false;

  // Fetch the topup request
  const [request] = await db
    .select()
    .from(topup_requests)
    .where(eq(topup_requests.id, params.id))
    .limit(1);

  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.status === "executed") return NextResponse.json({ error: "Already executed" }, { status: 409 });
  if (request.status === "rejected") return NextResponse.json({ error: "Request is rejected" }, { status: 409 });

  // Fetch client for balance model + platform fees (source of truth for commission rate)
  const [client] = await db
    .select({ id: clients.id, name: clients.name, balance_model: clients.balance_model, client_platform_fees: clients.client_platform_fees })
    .from(clients)
    .where(eq(clients.id, request.client_id))
    .limit(1);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Fetch ad account
  const [adAccount] = await db
    .select({
      id: ad_accounts.id,
      platform: ad_accounts.platform,
      top_up_fee_rate: ad_accounts.top_up_fee_rate,
      status: ad_accounts.status,
      supplier_id: ad_accounts.supplier_id,
      supplier_sub_account_id: ad_accounts.supplier_sub_account_id,
    })
    .from(ad_accounts)
    .where(eq(ad_accounts.id, request.ad_account_id))
    .limit(1);
  if (!adAccount) return NextResponse.json({ error: "Ad account not found" }, { status: 404 });
  if (adAccount.status === "disabled") {
    return NextResponse.json({ error: "This ad account is disabled and cannot receive top ups." }, { status: 400 });
  }
  if (adAccount.status === "deleted") {
    return NextResponse.json({ error: "This ad account has been deleted and cannot receive top ups." }, { status: 400 });
  }

  // Look up supplier fee rate for this sub-account + platform
  let supplierFeeRate = 0;
  if (adAccount.supplier_sub_account_id) {
    const [feeRow] = await db
      .select({ fee_rate: supplier_platform_fees.fee_rate })
      .from(supplier_platform_fees)
      .where(
        and(
          eq(supplier_platform_fees.supplier_sub_account_id, adAccount.supplier_sub_account_id),
          eq(supplier_platform_fees.platform, adAccount.platform)
        )
      )
      .limit(1);
    if (feeRow) supplierFeeRate = parseFloat(feeRow.fee_rate);
  }

  const amount = parseFloat(request.amount);

  // Re-check wallet balance at execution time
  const wallet_balance = await calculateWalletBalance(request.client_id, client.balance_model);
  if (!force && wallet_balance < amount) {
    return NextResponse.json({ error: "Insufficient funds", wallet_balance }, { status: 402 });
  }

  // Calculate fee snapshots — commission rate always from client_platform_fees (source of truth)
  const supplier_fee_amount = amount * (supplierFeeRate / 100);
  const platformFees = client.client_platform_fees as Record<string, number> | null;
  const top_up_fee_rate = platformFees?.[adAccount.platform] ?? parseFloat(adAccount.top_up_fee_rate);
  const top_up_fee_amount = amount * (top_up_fee_rate / 100);

  // Insert topup transaction
  const [txn] = await db
    .insert(transactions)
    .values({
      client_id: request.client_id,
      ad_account_id: request.ad_account_id,
      supplier_id: adAccount.supplier_id,
      type: "topup",
      amount: String(amount),
      currency: request.currency,
      is_crypto: false,
      supplier_fee_amount: String(supplier_fee_amount),
      supplier_fee_rate_snapshot: String(supplierFeeRate),
      top_up_fee_amount: String(top_up_fee_amount),
      description: `Top-up for ${adAccount.platform} ad account`,
      created_by: session.user.id,
    })
    .returning();

  // Update topup request status
  const [updatedRequest] = await db
    .update(topup_requests)
    .set({
      status: "executed",
      executed_by: session.user.id,
      executed_at: new Date(),
    })
    .where(eq(topup_requests.id, params.id))
    .returning();

  const new_wallet_balance = await calculateWalletBalance(request.client_id, client.balance_model);

  logAudit({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "Unknown",
    action: "topup_executed",
    details: {
      topup_request_id: params.id,
      client_id: request.client_id,
      client_name: client.name,
      amount: amount,
      currency: request.currency,
      ad_account_platform: adAccount.platform,
      supplier_id: adAccount.supplier_id,
    },
  });

  return NextResponse.json({
    request: updatedRequest,
    transaction: txn,
    wallet_balance: new_wallet_balance,
  });
}
