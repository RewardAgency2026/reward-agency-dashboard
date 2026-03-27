import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { ad_accounts, clients, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { calculateTopupFees } from "@/lib/services/topup";
import { updateBalanceCache } from "@/lib/balance";
import { updateAffiliatePreview } from "@/lib/services/commission";
import { logAudit } from "@/lib/audit";

const bodySchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(["USD", "EUR", "USDT", "USDC"]),
  notes: z.string().optional(),
  update_status: z.enum(["disabled", "deleted"]).nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "team"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }

  const { amount, currency, notes, update_status } = parsed.data;

  // Fetch ad account
  const [adAccount] = await db
    .select({
      id: ad_accounts.id,
      client_id: ad_accounts.client_id,
      platform: ad_accounts.platform,
      account_name: ad_accounts.account_name,
      account_id: ad_accounts.account_id,
      supplier_id: ad_accounts.supplier_id,
      supplier_sub_account_id: ad_accounts.supplier_sub_account_id,
      top_up_fee_rate: ad_accounts.top_up_fee_rate,
      status: ad_accounts.status,
    })
    .from(ad_accounts)
    .where(eq(ad_accounts.id, params.id))
    .limit(1);

  if (!adAccount) return NextResponse.json({ error: "Ad account not found" }, { status: 404 });

  // Fetch client
  const [client] = await db
    .select({
      id: clients.id,
      name: clients.name,
      client_code: clients.client_code,
      balance_model: clients.balance_model,
      client_platform_fees: clients.client_platform_fees,
      affiliate_id: clients.affiliate_id,
    })
    .from(clients)
    .where(eq(clients.id, adAccount.client_id))
    .limit(1);

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Calculate fees (same rates as the original top-up)
  const platformFees = client.client_platform_fees as Record<string, number> | null;
  const { top_up_fee_rate, top_up_fee_amount, supplier_fee_amount, supplierFeeRate } =
    await calculateTopupFees(adAccount, platformFees, amount);

  const commissionRefundAmount = top_up_fee_amount;
  const providerFeeRefundAmount = supplier_fee_amount;
  const totalCreditedToClient = amount + commissionRefundAmount;

  // INSERT transaction 1: ad_account_withdrawal (credits client wallet)
  await db.insert(transactions).values({
    client_id: adAccount.client_id,
    ad_account_id: adAccount.id,
    supplier_id: adAccount.supplier_id,
    type: "ad_account_withdrawal",
    amount: String(amount),
    currency,
    description: notes
      ? `Ad account withdrawal — ${adAccount.account_name} (${adAccount.platform}) — ${notes}`
      : `Ad account withdrawal — ${adAccount.account_name} (${adAccount.platform})`,
    created_by: session.user.id,
  });

  // INSERT transaction 2: commission_refund (credits client wallet)
  if (commissionRefundAmount > 0) {
    await db.insert(transactions).values({
      client_id: adAccount.client_id,
      ad_account_id: adAccount.id,
      supplier_id: adAccount.supplier_id,
      type: "commission_refund",
      amount: String(commissionRefundAmount),
      currency,
      top_up_fee_amount: String(commissionRefundAmount),
      description: `Commission refund ${top_up_fee_rate}% — ${adAccount.account_name} (${adAccount.platform})`,
      created_by: session.user.id,
    });
  }

  // INSERT transaction 3: supplier_fee_refund (supplier balance item — does NOT affect client wallet)
  if (providerFeeRefundAmount > 0) {
    await db.insert(transactions).values({
      client_id: adAccount.client_id,
      ad_account_id: adAccount.id,
      supplier_id: adAccount.supplier_id,
      type: "supplier_fee_refund",
      amount: String(providerFeeRefundAmount),
      currency,
      supplier_fee_amount: String(providerFeeRefundAmount),
      supplier_fee_rate_snapshot: String(supplierFeeRate),
      description: `Provider fee refund ${supplierFeeRate}% — ${adAccount.account_name}`,
      created_by: session.user.id,
    });
  }

  // Update ad account status if requested
  if (update_status != null) {
    await db.update(ad_accounts).set({ status: update_status }).where(eq(ad_accounts.id, adAccount.id));
  }

  // Update cached balance
  const new_wallet_balance = await updateBalanceCache(adAccount.client_id, client.balance_model);

  // Update affiliate commission preview with negative delta
  if (client.affiliate_id) {
    const now = new Date();
    await updateAffiliatePreview({
      affiliateId: client.affiliate_id,
      topUpFeeAmount: -commissionRefundAmount,
      supplierFeeAmount: -providerFeeRefundAmount,
      amount: -amount,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
  }

  await logAudit({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "Unknown",
    action: "ad_account_withdrawal",
    details: {
      ad_account_id: adAccount.id,
      ad_account_name: adAccount.account_name,
      platform: adAccount.platform,
      client_id: adAccount.client_id,
      client_name: client.name,
      client_code: client.client_code,
      amount,
      currency,
      commission_refund: commissionRefundAmount,
      provider_fee_refund: providerFeeRefundAmount,
      notes: notes ?? null,
      update_status: update_status ?? null,
    },
  });

  return NextResponse.json({
    withdrawal_amount: amount,
    commission_refund: commissionRefundAmount,
    provider_fee_refund: providerFeeRefundAmount,
    total_credited_to_client: totalCreditedToClient,
    new_wallet_balance,
    ad_account_status: update_status ?? adAccount.status,
  });
}
