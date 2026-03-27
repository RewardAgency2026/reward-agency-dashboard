import { db } from "@/db";
import { affiliates, affiliate_commissions, clients } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export async function updateAffiliatePreview(params: {
  affiliateId: string;
  topUpFeeAmount: number;
  supplierFeeAmount: number;
  amount: number;
  year: number;
  month: number;
}) {
  const { affiliateId, topUpFeeAmount, supplierFeeAmount, amount, year, month } = params;

  const [affiliate] = await db
    .select({ commission_rate: affiliates.commission_rate })
    .from(affiliates)
    .where(eq(affiliates.id, affiliateId))
    .limit(1);

  if (!affiliate) return;

  const commRate = parseFloat(affiliate.commission_rate);

  const [{ count: clientsCount }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(clients)
    .where(eq(clients.affiliate_id, affiliateId));

  const [existingPreview] = await db
    .select({ id: affiliate_commissions.id })
    .from(affiliate_commissions)
    .where(
      and(
        eq(affiliate_commissions.affiliate_id, affiliateId),
        eq(affiliate_commissions.period_year, year),
        eq(affiliate_commissions.period_month, month),
        eq(affiliate_commissions.status, "preview")
      )
    )
    .limit(1);

  const profitDelta = topUpFeeAmount - supplierFeeAmount;

  if (existingPreview) {
    await db.update(affiliate_commissions).set({
      total_commissions_gross: sql`total_commissions_gross + ${topUpFeeAmount}`,
      total_supplier_fees: sql`total_supplier_fees + ${supplierFeeAmount}`,
      total_profit_net: sql`total_profit_net + ${profitDelta}`,
      commission_amount: sql`(total_profit_net + ${profitDelta}) * ${commRate}::numeric / 100`,
      total_topups: sql`total_topups + ${amount}`,
      clients_count: clientsCount,
    }).where(eq(affiliate_commissions.id, existingPreview.id));
  } else {
    const profitNet = topUpFeeAmount - supplierFeeAmount;
    const commAmount = profitNet * (commRate / 100);
    await db.insert(affiliate_commissions).values({
      affiliate_id: affiliateId,
      period_year: year,
      period_month: month,
      clients_count: clientsCount,
      total_topups: String(amount),
      total_commissions_gross: String(topUpFeeAmount),
      total_supplier_fees: String(supplierFeeAmount),
      total_crypto_fees: "0",
      total_bank_fees: "0",
      total_profit_net: String(profitNet),
      commission_rate: String(commRate),
      commission_amount: String(commAmount),
      status: "preview",
    });
  }
}
