import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { suppliers, supplier_sub_accounts, supplier_platform_fees, ad_accounts, supplier_payments, transactions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { SuppliersTable } from "@/components/suppliers/suppliers-table";
import { AddSupplierModal } from "@/components/suppliers/add-supplier-modal";

export default async function SuppliersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = ["admin", "team"].includes(session.user.role);

  const [
    supplierRows,
    subAccountRows,
    feeRows,
    paymentSums,
    topupSums,
    adCountRows,
  ] = await Promise.all([
    db.select().from(suppliers).orderBy(suppliers.name),
    db.select().from(supplier_sub_accounts),
    db.select().from(supplier_platform_fees),
    db
      .select({
        supplier_id: supplier_payments.supplier_id,
        total: sql<string>`COALESCE(SUM(${supplier_payments.amount}), 0)`,
      })
      .from(supplier_payments)
      .groupBy(supplier_payments.supplier_id),
    db
      .select({
        supplier_id: ad_accounts.supplier_id,
        total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .innerJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
      .where(eq(transactions.type, "topup"))
      .groupBy(ad_accounts.supplier_id),
    db
      .select({
        supplier_id: ad_accounts.supplier_id,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(ad_accounts)
      .groupBy(ad_accounts.supplier_id),
  ]);

  // Build lookup maps
  const paymentMap = new Map(paymentSums.map((r) => [r.supplier_id, parseFloat(r.total)]));
  const topupMap = new Map(topupSums.map((r) => [r.supplier_id, parseFloat(r.total)]));
  const adCountMap = new Map(adCountRows.map((r) => [r.supplier_id, r.count]));

  const feesBySubAccount = new Map<string, { platform: string; fee_rate: string }[]>();
  for (const f of feeRows) {
    if (!feesBySubAccount.has(f.supplier_sub_account_id)) feesBySubAccount.set(f.supplier_sub_account_id, []);
    feesBySubAccount.get(f.supplier_sub_account_id)!.push({ platform: f.platform, fee_rate: f.fee_rate });
  }

  const subAccountsBySupplier = new Map<string, typeof subAccountRows>();
  for (const sa of subAccountRows) {
    if (!subAccountsBySupplier.has(sa.supplier_id)) subAccountsBySupplier.set(sa.supplier_id, []);
    subAccountsBySupplier.get(sa.supplier_id)!.push(sa);
  }

  const data = supplierRows.map((s) => {
    const subs = (subAccountsBySupplier.get(s.id) ?? []).map((sa) => ({
      ...sa,
      created_at: sa.created_at.toISOString(),
      platform_fees: feesBySubAccount.get(sa.id) ?? [],
    }));
    const totalPayments = paymentMap.get(s.id) ?? 0;
    const totalTopups = topupMap.get(s.id) ?? 0;
    return {
      ...s,
      created_at: s.created_at.toISOString(),
      sub_accounts: subs,
      kpis: {
        total_payments_sent: totalPayments,
        total_topups: totalTopups,
        remaining_balance: totalPayments - totalTopups,
        total_ad_accounts: adCountMap.get(s.id) ?? 0,
        total_sub_accounts: subs.length,
      },
    };
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        {isAdmin && <AddSupplierModal />}
      </div>
      <SuppliersTable suppliers={data} isAdmin={isAdmin} />
    </div>
  );
}
