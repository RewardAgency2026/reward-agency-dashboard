import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { suppliers, supplier_sub_accounts, supplier_platform_fees, ad_accounts, clients, supplier_payments, transactions } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { SupplierTabs } from "@/components/suppliers/supplier-tabs";

export default async function SupplierDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = ["admin", "team"].includes(session.user.role);

  const [supplierRow] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, params.id))
    .limit(1);

  if (!supplierRow) notFound();

  const [subAccountRows, adAccountRows, paymentRows, paymentSumRows, topupSumRows] = await Promise.all([
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
  ]);

  // Fetch fees for all sub-accounts
  const subAccountIds = subAccountRows.map((sa) => sa.id);
  const allFees = subAccountIds.length > 0
    ? await db
        .select()
        .from(supplier_platform_fees)
        .where(inArray(supplier_platform_fees.supplier_sub_account_id, subAccountIds))
    : [];

  const feesBySubAccount = new Map<string, typeof allFees>();
  for (const f of allFees) {
    if (!feesBySubAccount.has(f.supplier_sub_account_id)) feesBySubAccount.set(f.supplier_sub_account_id, []);
    feesBySubAccount.get(f.supplier_sub_account_id)!.push(f);
  }

  const subAccounts = subAccountRows.map((sa) => ({
    ...sa,
    created_at: sa.created_at.toISOString(),
    platform_fees: (feesBySubAccount.get(sa.id) ?? []).map((f) => ({
      id: f.id,
      platform: f.platform,
      fee_rate: f.fee_rate,
    })),
  }));

  const subAccountNameMap = new Map(subAccountRows.map((sa) => [sa.id, sa.name]));
  const adAccountsMapped = adAccountRows.map((a) => ({
    ...a,
    sub_account_name: a.supplier_sub_account_id ? (subAccountNameMap.get(a.supplier_sub_account_id) ?? null) : null,
    client_name: a.client_name ?? null,
    client_code: a.client_code ?? null,
  }));

  const totalPayments = parseFloat(paymentSumRows[0]?.total ?? "0");
  const totalTopups = parseFloat(topupSumRows[0]?.total ?? "0");

  const supplierData = {
    ...supplierRow,
    created_at: supplierRow.created_at.toISOString(),
    sub_accounts: subAccounts,
    ad_accounts: adAccountsMapped,
    payments: paymentRows.map((p) => ({
      ...p,
      paid_at: p.paid_at?.toISOString() ?? null,
      created_at: p.created_at.toISOString(),
    })),
    kpis: {
      total_payments_sent: totalPayments,
      total_topups: totalTopups,
      remaining_balance: totalPayments - totalTopups,
      total_ad_accounts: adAccountRows.length,
      total_sub_accounts: subAccountRows.length,
    },
  };

  return <SupplierTabs supplier={supplierData} isAdmin={isAdmin} />;
}
