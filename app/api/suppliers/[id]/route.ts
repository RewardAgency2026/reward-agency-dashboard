import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  suppliers, supplier_sub_accounts, supplier_platform_fees,
  ad_accounts, supplier_payments, clients, transactions,
} from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  contact_email: z.string().email().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, params.id))
    .limit(1);
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [subAccountRows, adAccountRows, payments, paymentSumRows, topupSumRows, topupFeesSumRows, withdrawalSumRows, feeRefundSumRows] = await Promise.all([
    db.select().from(supplier_sub_accounts).where(eq(supplier_sub_accounts.supplier_id, params.id)),

    db
      .select({
        id: ad_accounts.id,
        platform: ad_accounts.platform,
        account_id: ad_accounts.account_id,
        account_name: ad_accounts.account_name,
        top_up_fee_rate: ad_accounts.top_up_fee_rate,
        status: ad_accounts.status,
        supplier_sub_account_id: ad_accounts.supplier_sub_account_id,
        client_name: clients.name,
        client_code: clients.client_code,
      })
      .from(ad_accounts)
      .leftJoin(clients, eq(ad_accounts.client_id, clients.id))
      .where(eq(ad_accounts.supplier_id, params.id))
      .orderBy(desc(ad_accounts.created_at)),

    db
      .select()
      .from(supplier_payments)
      .where(eq(supplier_payments.supplier_id, params.id))
      .orderBy(desc(supplier_payments.created_at)),

    db
      .select({ total: sql<string>`COALESCE(SUM(${supplier_payments.amount}), 0)` })
      .from(supplier_payments)
      .where(eq(supplier_payments.supplier_id, params.id)),

    db
      .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .innerJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
      .where(and(
        eq(transactions.type, "topup"),
        eq(ad_accounts.supplier_id, params.id)
      )),

    // Supplier fees paid on each topup (separate from topup amount)
    db
      .select({ total: sql<string>`COALESCE(SUM(${transactions.supplier_fee_amount}), 0)` })
      .from(transactions)
      .innerJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
      .where(and(
        eq(transactions.type, "topup"),
        eq(ad_accounts.supplier_id, params.id)
      )),

    db
      .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .innerJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
      .where(and(
        eq(transactions.type, "ad_account_withdrawal"),
        eq(ad_accounts.supplier_id, params.id)
      )),

    db
      .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .innerJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
      .where(and(
        eq(transactions.type, "supplier_fee_refund"),
        eq(ad_accounts.supplier_id, params.id)
      )),
  ]);

  // Fetch fees for all sub-accounts
  const subAccountIds = subAccountRows.map((sa) => sa.id);
  const allFees = subAccountIds.length > 0
    ? await db
        .select()
        .from(supplier_platform_fees)
        .where(inArray(supplier_platform_fees.supplier_sub_account_id, subAccountIds))
    : [];

  // Group fees by sub-account
  const feesBySubAccount = new Map<string, typeof allFees>();
  for (const f of allFees) {
    if (!feesBySubAccount.has(f.supplier_sub_account_id)) feesBySubAccount.set(f.supplier_sub_account_id, []);
    feesBySubAccount.get(f.supplier_sub_account_id)!.push(f);
  }
  const subAccounts = subAccountRows.map((sa) => ({
    ...sa,
    platform_fees: feesBySubAccount.get(sa.id) ?? [],
  }));

  // Add sub-account name to ad-accounts
  const subAccountNameMap = new Map(subAccountRows.map((sa) => [sa.id, sa.name]));
  const adAccountsEnriched = adAccountRows.map((a) => ({
    ...a,
    sub_account_name: a.supplier_sub_account_id ? (subAccountNameMap.get(a.supplier_sub_account_id) ?? null) : null,
  }));

  const totalPayments = parseFloat(paymentSumRows[0]?.total ?? "0");
  const totalTopups = parseFloat(topupSumRows[0]?.total ?? "0");
  const totalTopupFees = parseFloat(topupFeesSumRows[0]?.total ?? "0");
  const totalWithdrawals = parseFloat(withdrawalSumRows[0]?.total ?? "0");
  const totalFeeRefunds = parseFloat(feeRefundSumRows[0]?.total ?? "0");

  return NextResponse.json({
    ...supplier,
    sub_accounts: subAccounts,
    ad_accounts: adAccountsEnriched,
    payments,
    kpis: {
      total_payments_sent: totalPayments,
      total_topups: totalTopups,
      remaining_balance: totalPayments - totalTopups - totalTopupFees + totalWithdrawals + totalFeeRefunds,
      total_ad_accounts: adAccountRows.length,
      total_sub_accounts: subAccountRows.length,
    },
  }, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }

  const d = parsed.data;
  const updates: Record<string, unknown> = {};
  if (d.name !== undefined) updates.name = d.name;
  if ("contact_email" in d) updates.contact_email = d.contact_email ?? null;
  if (d.status !== undefined) updates.status = d.status;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(suppliers)
    .set(updates)
    .where(eq(suppliers.id, params.id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  logAudit({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "Unknown",
    action: "supplier_updated",
    details: { supplier_name: updated.name },
  });

  return NextResponse.json(updated);
}
