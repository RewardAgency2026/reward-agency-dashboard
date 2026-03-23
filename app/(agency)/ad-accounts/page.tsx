import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { ad_accounts, clients, suppliers, supplier_sub_accounts, supplier_platform_fees } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { AdAccountsTable } from "@/components/ad-accounts/ad-accounts-table";
import { AddAdAccountModal } from "@/components/ad-accounts/add-ad-account-modal";

export default async function AdAccountsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = ["admin", "team"].includes(session.user.role);

  const [adAccountRows, clientRows, supplierRows, subAccountRows] = await Promise.all([
    db
      .select({
        id: ad_accounts.id,
        platform: ad_accounts.platform,
        account_id: ad_accounts.account_id,
        account_name: ad_accounts.account_name,
        top_up_fee_rate: ad_accounts.top_up_fee_rate,
        status: ad_accounts.status,
        supplier_id: ad_accounts.supplier_id,
        supplier_sub_account_id: ad_accounts.supplier_sub_account_id,
        client_name: clients.name,
        client_code: clients.client_code,
        supplier_name: suppliers.name,
        sub_account_name: supplier_sub_accounts.name,
      })
      .from(ad_accounts)
      .leftJoin(clients, eq(ad_accounts.client_id, clients.id))
      .leftJoin(suppliers, eq(ad_accounts.supplier_id, suppliers.id))
      .leftJoin(supplier_sub_accounts, eq(ad_accounts.supplier_sub_account_id, supplier_sub_accounts.id))
      .orderBy(ad_accounts.created_at),

    db
      .select({
        id: clients.id,
        name: clients.name,
        client_code: clients.client_code,
        client_platform_fees: clients.client_platform_fees,
      })
      .from(clients)
      .where(eq(clients.status, "active"))
      .orderBy(clients.name),

    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.status, "active"))
      .orderBy(suppliers.name),

    db.select().from(supplier_sub_accounts).where(eq(supplier_sub_accounts.status, "active")),
  ]);

  // Fetch platform fees for all sub-accounts
  const subIds = subAccountRows.map((sa) => sa.id);
  const feeRows = subIds.length > 0
    ? await db.select().from(supplier_platform_fees).where(inArray(supplier_platform_fees.supplier_sub_account_id, subIds))
    : [];

  const feesBySubAccount = new Map<string, Record<string, number>>();
  for (const f of feeRows) {
    if (!feesBySubAccount.has(f.supplier_sub_account_id)) feesBySubAccount.set(f.supplier_sub_account_id, {});
    feesBySubAccount.get(f.supplier_sub_account_id)![f.platform] = parseFloat(f.fee_rate);
  }

  // Build supplier options with nested sub-accounts + fees
  const subsBySupplier = new Map<string, Array<{ id: string; name: string; platform_fees: Record<string, number> }>>();
  for (const sa of subAccountRows) {
    if (!subsBySupplier.has(sa.supplier_id)) subsBySupplier.set(sa.supplier_id, []);
    subsBySupplier.get(sa.supplier_id)!.push({
      id: sa.id,
      name: sa.name,
      platform_fees: feesBySubAccount.get(sa.id) ?? {},
    });
  }

  const supplierOptions = supplierRows.map((s) => ({
    id: s.id,
    name: s.name,
    sub_accounts: subsBySupplier.get(s.id) ?? [],
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ad Accounts</h1>
        {isAdmin && (
          <AddAdAccountModal clients={clientRows} suppliers={supplierOptions} />
        )}
      </div>
      <AdAccountsTable
        adAccounts={adAccountRows.map((a) => ({
          ...a,
          client_name: a.client_name ?? null,
          client_code: a.client_code ?? null,
          supplier_name: a.supplier_name ?? null,
          sub_account_name: a.sub_account_name ?? null,
        }))}
        suppliers={supplierOptions}
        isAdmin={isAdmin}
      />
    </div>
  );
}
