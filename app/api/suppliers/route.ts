import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { suppliers, supplier_sub_accounts, supplier_platform_fees, ad_accounts, supplier_payments, transactions } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contact_email: z.string().email("Invalid email").nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    allSuppliers,
    allSubAccounts,
    allFees,
    paymentSums,
    topupSums,
    topupFeeSums,
    adAccountCounts,
    withdrawalSums,
    feeRefundSums,
  ] = await Promise.all([
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        contact_email: suppliers.contact_email,
        status: suppliers.status,
        created_at: suppliers.created_at,
      })
      .from(suppliers)
      .orderBy(desc(suppliers.created_at)),

    db
      .select({
        id: supplier_sub_accounts.id,
        supplier_id: supplier_sub_accounts.supplier_id,
        name: supplier_sub_accounts.name,
        status: supplier_sub_accounts.status,
      })
      .from(supplier_sub_accounts),

    db
      .select({
        supplier_sub_account_id: supplier_platform_fees.supplier_sub_account_id,
        platform: supplier_platform_fees.platform,
        fee_rate: supplier_platform_fees.fee_rate,
      })
      .from(supplier_platform_fees),

    // Total payments sent per supplier
    db
      .select({
        supplier_id: supplier_payments.supplier_id,
        total: sql<string>`COALESCE(SUM(${supplier_payments.amount}), 0)`,
      })
      .from(supplier_payments)
      .groupBy(supplier_payments.supplier_id),

    // Total topups per supplier (via ad_accounts join)
    db
      .select({
        supplier_id: ad_accounts.supplier_id,
        total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .innerJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
      .where(eq(transactions.type, "topup"))
      .groupBy(ad_accounts.supplier_id),

    // Total supplier_fee_amount on topups per supplier (via ad_accounts join)
    db
      .select({
        supplier_id: ad_accounts.supplier_id,
        total: sql<string>`COALESCE(SUM(${transactions.supplier_fee_amount}), 0)`,
      })
      .from(transactions)
      .innerJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
      .where(eq(transactions.type, "topup"))
      .groupBy(ad_accounts.supplier_id),

    // Ad account counts per supplier
    db
      .select({
        supplier_id: ad_accounts.supplier_id,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(ad_accounts)
      .groupBy(ad_accounts.supplier_id),

    // Total ad_account_withdrawal per supplier (via ad_accounts join)
    db
      .select({
        supplier_id: ad_accounts.supplier_id,
        total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .innerJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
      .where(eq(transactions.type, "ad_account_withdrawal"))
      .groupBy(ad_accounts.supplier_id),

    // Total supplier_fee_refund per supplier (via ad_accounts join)
    db
      .select({
        supplier_id: ad_accounts.supplier_id,
        total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .innerJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
      .where(eq(transactions.type, "supplier_fee_refund"))
      .groupBy(ad_accounts.supplier_id),
  ]);

  // Build lookup maps
  const paymentMap = new Map(paymentSums.map((r) => [r.supplier_id, parseFloat(r.total)]));
  const topupMap = new Map(topupSums.map((r) => [r.supplier_id, parseFloat(r.total)]));
  const topupFeeMap = new Map(topupFeeSums.map((r) => [r.supplier_id, parseFloat(r.total)]));
  const adCountMap = new Map(adAccountCounts.map((r) => [r.supplier_id, r.count]));
  const withdrawalMap = new Map(withdrawalSums.map((r) => [r.supplier_id, parseFloat(r.total)]));
  const feeRefundMap = new Map(feeRefundSums.map((r) => [r.supplier_id, parseFloat(r.total)]));

  // Group sub-accounts by supplier_id
  const subAccountMap = new Map<string, typeof allSubAccounts>();
  for (const sa of allSubAccounts) {
    if (!subAccountMap.has(sa.supplier_id)) subAccountMap.set(sa.supplier_id, []);
    subAccountMap.get(sa.supplier_id)!.push(sa);
  }

  // Group fees by sub-account id
  const feesBySubAccount = new Map<string, typeof allFees>();
  for (const f of allFees) {
    if (!feesBySubAccount.has(f.supplier_sub_account_id)) feesBySubAccount.set(f.supplier_sub_account_id, []);
    feesBySubAccount.get(f.supplier_sub_account_id)!.push(f);
  }

  return NextResponse.json(
    allSuppliers.map((s) => {
      const subAccounts = (subAccountMap.get(s.id) ?? []).map((sa) => ({
        ...sa,
        platform_fees: feesBySubAccount.get(sa.id) ?? [],
      }));
      const totalPayments = paymentMap.get(s.id) ?? 0;
      const totalTopups = topupMap.get(s.id) ?? 0;
      return {
        ...s,
        sub_accounts: subAccounts,
        kpis: {
          total_payments_sent: totalPayments,
          total_topups: totalTopups,
          remaining_balance: totalPayments - totalTopups - (topupFeeMap.get(s.id) ?? 0) + (withdrawalMap.get(s.id) ?? 0) + (feeRefundMap.get(s.id) ?? 0),
          total_ad_accounts: adCountMap.get(s.id) ?? 0,
          total_sub_accounts: subAccounts.length,
        },
      };
    }),
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }

  const [newSupplier] = await db
    .insert(suppliers)
    .values({ name: parsed.data.name, contact_email: parsed.data.contact_email ?? null })
    .returning();

  logAudit({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "Unknown",
    action: "supplier_created",
    details: { supplier_name: newSupplier.name },
  });

  return NextResponse.json(newSupplier, { status: 201 });
}
