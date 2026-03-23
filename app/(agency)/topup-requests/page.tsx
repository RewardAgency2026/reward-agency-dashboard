import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { topup_requests, clients, ad_accounts, suppliers, supplier_sub_accounts, supplier_platform_fees } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { calculateWalletBalances, balanceFromData } from "@/lib/balance";
import { TopupRequestsTable, type TopupRequestRow } from "@/components/topup-requests/topup-requests-table";
import { NewRequestModal } from "@/components/topup-requests/new-request-modal";

export default async function TopupRequestsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = ["admin", "team"].includes(session.user.role);

  // Fetch all topup requests with joins
  const rows = await db
    .select({
      id: topup_requests.id,
      client_id: topup_requests.client_id,
      ad_account_id: topup_requests.ad_account_id,
      supplier_id: topup_requests.supplier_id,
      amount: topup_requests.amount,
      currency: topup_requests.currency,
      status: topup_requests.status,
      notes: topup_requests.notes,
      executed_by: topup_requests.executed_by,
      executed_at: topup_requests.executed_at,
      created_at: topup_requests.created_at,
      client_name: clients.name,
      client_code: clients.client_code,
      client_balance_model: clients.balance_model,
      ad_account_platform: ad_accounts.platform,
      ad_account_name: ad_accounts.account_name,
      top_up_fee_rate: ad_accounts.top_up_fee_rate,
      supplier_name: suppliers.name,
      sub_account_name: supplier_sub_accounts.name,
      supplier_fee_rate: supplier_platform_fees.fee_rate,
    })
    .from(topup_requests)
    .leftJoin(clients, eq(topup_requests.client_id, clients.id))
    .leftJoin(ad_accounts, eq(topup_requests.ad_account_id, ad_accounts.id))
    .leftJoin(suppliers, eq(topup_requests.supplier_id, suppliers.id))
    .leftJoin(supplier_sub_accounts, eq(ad_accounts.supplier_sub_account_id, supplier_sub_accounts.id))
    .leftJoin(
      supplier_platform_fees,
      and(
        eq(supplier_platform_fees.supplier_sub_account_id, supplier_sub_accounts.id),
        eq(supplier_platform_fees.platform, ad_accounts.platform)
      )
    )
    .orderBy(desc(topup_requests.created_at));

  // Batch compute wallet balances
  const uniqueClientIds = [...new Set(rows.map((r) => r.client_id))];
  const balanceMap = await calculateWalletBalances(uniqueClientIds);

  const requestRows: TopupRequestRow[] = rows.map((r) => ({
    ...r,
    executed_at: r.executed_at?.toISOString() ?? null,
    created_at: r.created_at.toISOString(),
    wallet_balance: balanceFromData(balanceMap.get(r.client_id), r.client_balance_model ?? "classic"),
  }));

  // Fetch data for NewRequestModal
  const [clientRows, adAccountRows] = await Promise.all([
    db
      .select({
        id: clients.id,
        name: clients.name,
        client_code: clients.client_code,
        balance_model: clients.balance_model,
        billing_currency: clients.billing_currency,
      })
      .from(clients)
      .where(eq(clients.status, "active"))
      .orderBy(clients.name),

    db
      .select({
        id: ad_accounts.id,
        client_id: ad_accounts.client_id,
        platform: ad_accounts.platform,
        account_name: ad_accounts.account_name,
        status: ad_accounts.status,
      })
      .from(ad_accounts)
      .where(eq(ad_accounts.status, "active")),
  ]);

  // Attach wallet balances to clients for NewRequestModal
  const clientBalanceMap = await calculateWalletBalances(clientRows.map((c) => c.id));
  const clientOptions = clientRows.map((c) => ({
    ...c,
    wallet_balance: balanceFromData(clientBalanceMap.get(c.id), c.balance_model),
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Top Ups</h1>
        {isAdmin && (
          <NewRequestModal clients={clientOptions} adAccounts={adAccountRows} label="New Top-Up" />
        )}
      </div>
      <TopupRequestsTable requests={requestRows} isAdmin={isAdmin} />
    </div>
  );
}
