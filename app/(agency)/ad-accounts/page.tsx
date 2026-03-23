import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { ad_accounts, clients, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AdAccountsTable } from "@/components/ad-accounts/ad-accounts-table";
import { AddAdAccountModal } from "@/components/ad-accounts/add-ad-account-modal";

export default async function AdAccountsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = ["admin", "team"].includes(session.user.role);

  const [adAccountRows, clientRows, supplierRows] = await Promise.all([
    db
      .select({
        id: ad_accounts.id,
        platform: ad_accounts.platform,
        account_id: ad_accounts.account_id,
        account_name: ad_accounts.account_name,
        top_up_fee_rate: ad_accounts.top_up_fee_rate,
        status: ad_accounts.status,
        supplier_id: ad_accounts.supplier_id,
        client_name: clients.name,
        client_code: clients.client_code,
        supplier_name: suppliers.name,
      })
      .from(ad_accounts)
      .leftJoin(clients, eq(ad_accounts.client_id, clients.id))
      .leftJoin(suppliers, eq(ad_accounts.supplier_id, suppliers.id))
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
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ad Accounts</h1>
        {isAdmin && (
          <AddAdAccountModal clients={clientRows} suppliers={supplierRows} />
        )}
      </div>
      <AdAccountsTable
        adAccounts={adAccountRows.map((a) => ({ ...a, client_name: a.client_name ?? null, client_code: a.client_code ?? null, supplier_name: a.supplier_name ?? null }))}
        suppliers={supplierRows}
        isAdmin={isAdmin}
      />
    </div>
  );
}
