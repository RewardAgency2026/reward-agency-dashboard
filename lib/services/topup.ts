import { db } from "@/db";
import { topup_requests, clients, ad_accounts, supplier_platform_fees, transactions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { calculateWalletBalance, updateBalanceCache } from "@/lib/balance";
import { logAudit } from "@/lib/audit";
import { updateAffiliatePreview } from "./commission";

export interface TopupFees {
  supplierFeeRate: number;
  supplier_fee_amount: number;
  top_up_fee_rate: number;
  top_up_fee_amount: number;
}

export async function calculateTopupFees(adAccount: {
  id: string;
  platform: string;
  account_name: string;
  top_up_fee_rate: string;
  supplier_sub_account_id: string | null;
}, clientPlatformFees: Record<string, number> | null, amount: number): Promise<TopupFees> {
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

  const supplier_fee_amount = amount * (supplierFeeRate / 100);
  const top_up_fee_rate = clientPlatformFees?.[adAccount.platform] ?? parseFloat(adAccount.top_up_fee_rate);
  const top_up_fee_amount = amount * (top_up_fee_rate / 100);

  return { supplierFeeRate, supplier_fee_amount, top_up_fee_rate, top_up_fee_amount };
}

export async function executeTopup(params: {
  topupRequestId: string;
  userId: string;
  userName: string;
  force?: boolean;
}) {
  const { topupRequestId, userId, userName, force = false } = params;

  const [request] = await db
    .select()
    .from(topup_requests)
    .where(eq(topup_requests.id, topupRequestId))
    .limit(1);

  if (!request) throw Object.assign(new Error("Not found"), { status: 404 });
  if (request.status === "executed") throw Object.assign(new Error("Already executed"), { status: 409 });
  if (request.status === "rejected") throw Object.assign(new Error("Request is rejected"), { status: 409 });

  const [[client], [adAccount]] = await Promise.all([
    db.select({
      id: clients.id, name: clients.name, balance_model: clients.balance_model,
      client_platform_fees: clients.client_platform_fees, affiliate_id: clients.affiliate_id,
    }).from(clients).where(eq(clients.id, request.client_id)).limit(1),
    db.select({
      id: ad_accounts.id, platform: ad_accounts.platform, account_name: ad_accounts.account_name,
      top_up_fee_rate: ad_accounts.top_up_fee_rate, status: ad_accounts.status,
      supplier_id: ad_accounts.supplier_id, supplier_sub_account_id: ad_accounts.supplier_sub_account_id,
    }).from(ad_accounts).where(eq(ad_accounts.id, request.ad_account_id)).limit(1),
  ]);

  if (!client) throw Object.assign(new Error("Client not found"), { status: 404 });
  if (!adAccount) throw Object.assign(new Error("Ad account not found"), { status: 404 });
  if (adAccount.status === "disabled") throw Object.assign(new Error("This ad account is disabled and cannot receive top ups."), { status: 400 });
  if (adAccount.status === "deleted") throw Object.assign(new Error("This ad account has been deleted and cannot receive top ups."), { status: 400 });

  const amount = parseFloat(request.amount);
  const platformFees = client.client_platform_fees as Record<string, number> | null;
  const { supplierFeeRate, supplier_fee_amount, top_up_fee_rate, top_up_fee_amount } = await calculateTopupFees(adAccount, platformFees, amount);

  const wallet_balance = await calculateWalletBalance(request.client_id, client.balance_model);
  if (!force && wallet_balance < amount + top_up_fee_amount) {
    throw Object.assign(new Error("Insufficient funds"), { status: 402, wallet_balance });
  }

  const [existingTxn] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.topup_request_id, topupRequestId))
    .limit(1);

  if (existingTxn) throw Object.assign(new Error("This top up has already been executed"), { status: 409 });

  const [topupTxn] = await db.insert(transactions).values({
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
    created_by: userId,
    topup_request_id: topupRequestId,
  }).returning();

  let commissionTxn = null;
  if (top_up_fee_amount > 0) {
    const [row] = await db.insert(transactions).values({
      client_id: request.client_id,
      ad_account_id: request.ad_account_id,
      supplier_id: adAccount.supplier_id,
      type: "commission_fee",
      amount: String(top_up_fee_amount),
      currency: request.currency,
      is_crypto: false,
      top_up_fee_amount: String(top_up_fee_amount),
      description: `Commission fee ${top_up_fee_rate}% — ${adAccount.platform} — ${adAccount.account_name}`,
      created_by: userId,
    }).returning();
    commissionTxn = row;
  }

  if (client.affiliate_id) {
    const now = new Date();
    await updateAffiliatePreview({
      affiliateId: client.affiliate_id,
      topUpFeeAmount: top_up_fee_amount,
      supplierFeeAmount: supplier_fee_amount,
      amount,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
  }

  const [updatedRequest] = await db.update(topup_requests).set({
    status: "executed",
    executed_by: userId,
    executed_at: new Date(),
  }).where(eq(topup_requests.id, topupRequestId)).returning();

  const new_wallet_balance = await updateBalanceCache(request.client_id, client.balance_model);

  await logAudit({
    userId,
    userName,
    action: "topup_executed",
    details: {
      topup_request_id: topupRequestId,
      client_id: request.client_id,
      client_name: client.name,
      amount,
      commission_fee: top_up_fee_amount,
      currency: request.currency,
      ad_account_platform: adAccount.platform,
      supplier_id: adAccount.supplier_id,
    },
  });

  return { request: updatedRequest, transaction: topupTxn, commission_transaction: commissionTxn, wallet_balance: new_wallet_balance };
}
