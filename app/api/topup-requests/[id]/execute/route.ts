import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { topup_requests, clients, ad_accounts, supplier_platform_fees, transactions, affiliates, affiliate_commissions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
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

  // Fetch client + ad account in parallel
  const [[client], [adAccount]] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name, balance_model: clients.balance_model, client_platform_fees: clients.client_platform_fees, affiliate_id: clients.affiliate_id })
      .from(clients)
      .where(eq(clients.id, request.client_id))
      .limit(1),
    db
      .select({
        id: ad_accounts.id,
        platform: ad_accounts.platform,
        account_name: ad_accounts.account_name,
        top_up_fee_rate: ad_accounts.top_up_fee_rate,
        status: ad_accounts.status,
        supplier_id: ad_accounts.supplier_id,
        supplier_sub_account_id: ad_accounts.supplier_sub_account_id,
      })
      .from(ad_accounts)
      .where(eq(ad_accounts.id, request.ad_account_id))
      .limit(1),
  ]);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
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

  // Calculate fee amounts — commission rate always from client_platform_fees (source of truth)
  const supplier_fee_amount = amount * (supplierFeeRate / 100);
  const platformFees = client.client_platform_fees as Record<string, number> | null;
  const top_up_fee_rate = platformFees?.[adAccount.platform] ?? parseFloat(adAccount.top_up_fee_rate);
  const top_up_fee_amount = amount * (top_up_fee_rate / 100);

  // Re-check wallet balance at execution time (must cover top-up + commission)
  const wallet_balance = await calculateWalletBalance(request.client_id, client.balance_model);
  if (!force && wallet_balance < amount + top_up_fee_amount) {
    return NextResponse.json({ error: "Insufficient funds", wallet_balance }, { status: 402 });
  }

  // Transaction 1 — Top-up debit
  const [topupTxn] = await db
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
      description: `Top-up — ${adAccount.account_name}`,
      created_by: session.user.id,
    })
    .returning();

  // Transaction 2 — Client commission fee debit (only when rate > 0)
  let commissionTxn = null;
  if (top_up_fee_amount > 0) {
    const [row] = await db
      .insert(transactions)
      .values({
        client_id: request.client_id,
        ad_account_id: request.ad_account_id,
        supplier_id: adAccount.supplier_id,
        type: "commission_fee",
        amount: String(top_up_fee_amount),
        currency: request.currency,
        is_crypto: false,
        top_up_fee_amount: String(top_up_fee_amount),
        description: `Commission fee ${top_up_fee_rate}% — ${adAccount.platform} — ${adAccount.account_name}`,
        created_by: session.user.id,
      })
      .returning();
    commissionTxn = row;
  }

  // After commission transaction: auto-update affiliate commission preview record
  if (client.affiliate_id) {
    const affiliateId = client.affiliate_id;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const [affiliate] = await db
      .select({ commission_rate: affiliates.commission_rate })
      .from(affiliates)
      .where(eq(affiliates.id, affiliateId))
      .limit(1);

    if (affiliate) {
      const commRate = parseFloat(affiliate.commission_rate);

      // Count total clients referred by this affiliate
      const [{ count: clientsCount }] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(clients)
        .where(eq(clients.affiliate_id, affiliateId));

      // Look for existing 'preview' record this month
      const [existingPreview] = await db
        .select()
        .from(affiliate_commissions)
        .where(
          and(
            eq(affiliate_commissions.affiliate_id, affiliateId),
            eq(affiliate_commissions.period_year, currentYear),
            eq(affiliate_commissions.period_month, currentMonth),
            eq(affiliate_commissions.status, "preview")
          )
        )
        .limit(1);

      if (existingPreview) {
        const newGross = parseFloat(existingPreview.total_commissions_gross) + top_up_fee_amount;
        const newSupFees = parseFloat(existingPreview.total_supplier_fees) + supplier_fee_amount;
        const newProfitNet = newGross - newSupFees;
        const newCommAmount = newProfitNet * (commRate / 100);
        await db
          .update(affiliate_commissions)
          .set({
            total_commissions_gross: String(newGross),
            total_supplier_fees: String(newSupFees),
            total_profit_net: String(newProfitNet),
            commission_amount: String(newCommAmount),
            clients_count: clientsCount,
          })
          .where(eq(affiliate_commissions.id, existingPreview.id));
      } else {
        // Create new preview (never modify 'calculated' or 'paid' records)
        const profitNet = top_up_fee_amount - supplier_fee_amount;
        const commAmount = profitNet * (commRate / 100);
        await db.insert(affiliate_commissions).values({
          affiliate_id: affiliateId,
          period_year: currentYear,
          period_month: currentMonth,
          clients_count: clientsCount,
          total_topups: "0",
          total_commissions_gross: String(top_up_fee_amount),
          total_supplier_fees: String(supplier_fee_amount),
          total_crypto_fees: "0",
          total_bank_fees: "0",
          total_profit_net: String(profitNet),
          commission_rate: String(commRate),
          commission_amount: String(commAmount),
          status: "preview",
        });
      }
    }
  }

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
      commission_fee: top_up_fee_amount,
      currency: request.currency,
      ad_account_platform: adAccount.platform,
      supplier_id: adAccount.supplier_id,
    },
  });

  return NextResponse.json({
    request: updatedRequest,
    transaction: topupTxn,
    commission_transaction: commissionTxn,
    wallet_balance: new_wallet_balance,
  });
}
