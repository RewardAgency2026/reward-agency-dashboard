import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { clients, affiliates, transactions, ad_accounts, suppliers, supplier_sub_accounts, supplier_platform_fees, topup_requests } from "@/db/schema";
import { and, eq, desc, inArray } from "drizzle-orm";
import { calculateWalletBalance, calculateWalletBalances, balanceFromData } from "@/lib/balance";
import { ClientTabs } from "@/components/clients/client-tabs";
import type { TopupRequestRow } from "@/components/topup-requests/topup-requests-table";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) redirect("/login");

  const [clientRow] = await db
    .select({
      id: clients.id,
      client_code: clients.client_code,
      name: clients.name,
      email: clients.email,
      company: clients.company,
      status: clients.status,
      balance_model: clients.balance_model,
      billing_currency: clients.billing_currency,
      crypto_fee_rate: clients.crypto_fee_rate,
      affiliate_id: clients.affiliate_id,
      affiliate_name: affiliates.name,
      affiliate_code: affiliates.affiliate_code,
      onboarding_source: clients.onboarding_source,
      notes: clients.notes,
      has_setup: clients.has_setup,
      setup_monthly_fee: clients.setup_monthly_fee,
      setup_monthly_cost: clients.setup_monthly_cost,
      client_platform_fees: clients.client_platform_fees,
      created_at: clients.created_at,
    })
    .from(clients)
    .leftJoin(affiliates, eq(clients.affiliate_id, affiliates.id))
    .where(eq(clients.id, params.id))
    .limit(1);

  if (!clientRow) notFound();

  const [wallet_balance, recentTxns, adAccountsList, affiliateList, supplierList] = await Promise.all([
    calculateWalletBalance(clientRow.id, clientRow.balance_model),

    db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        currency: transactions.currency,
        is_crypto: transactions.is_crypto,
        description: transactions.description,
        spend_date: transactions.spend_date,
        created_at: transactions.created_at,
      })
      .from(transactions)
      .where(eq(transactions.client_id, params.id))
      .orderBy(desc(transactions.created_at))
      .limit(10),

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
      })
      .from(ad_accounts)
      .where(eq(ad_accounts.client_id, params.id)),

    db
      .select({ id: affiliates.id, name: affiliates.name, affiliate_code: affiliates.affiliate_code })
      .from(affiliates)
      .where(eq(affiliates.status, "active")),

    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.status, "active"))
      .orderBy(suppliers.name),
  ]);

  // Fetch sub-accounts + fees for supplier options in AddAdAccountModal
  const subAccountRows = await db
    .select()
    .from(supplier_sub_accounts)
    .where(eq(supplier_sub_accounts.status, "active"));

  const subIds = subAccountRows.map((sa) => sa.id);
  const feeRows = subIds.length > 0
    ? await db.select().from(supplier_platform_fees).where(inArray(supplier_platform_fees.supplier_sub_account_id, subIds))
    : [];

  const feesBySubAccount = new Map<string, Record<string, number>>();
  for (const f of feeRows) {
    if (!feesBySubAccount.has(f.supplier_sub_account_id)) feesBySubAccount.set(f.supplier_sub_account_id, {});
    feesBySubAccount.get(f.supplier_sub_account_id)![f.platform] = parseFloat(f.fee_rate);
  }

  const subsBySupplier = new Map<string, Array<{ id: string; name: string; platform_fees: Record<string, number> }>>();
  for (const sa of subAccountRows) {
    if (!subsBySupplier.has(sa.supplier_id)) subsBySupplier.set(sa.supplier_id, []);
    subsBySupplier.get(sa.supplier_id)!.push({ id: sa.id, name: sa.name, platform_fees: feesBySubAccount.get(sa.id) ?? {} });
  }

  const suppliersWithSubs = supplierList.map((s) => ({
    id: s.id,
    name: s.name,
    sub_accounts: subsBySupplier.get(s.id) ?? [],
  }));

  // Fetch topup requests for this client (with supplier/sub-account fee joins)
  const topupRows = await db
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
    .where(eq(topup_requests.client_id, params.id))
    .orderBy(desc(topup_requests.created_at));

  const topupRequestRows: TopupRequestRow[] = topupRows.map((r) => ({
    ...r,
    executed_at: r.executed_at?.toISOString() ?? null,
    created_at: r.created_at.toISOString(),
    wallet_balance,
  }));

  // Ad account options for NewRequestModal in the client tab
  const adAccountOptions = adAccountsList.map((a) => ({
    id: a.id,
    client_id: params.id,
    platform: a.platform,
    account_name: a.account_name,
    top_up_fee_rate: a.top_up_fee_rate,
    status: a.status,
  }));

  const canCredit = ["admin", "team"].includes(session.user.role);

  const clientData = {
    ...clientRow,
    created_at: clientRow.created_at.toISOString(),
    wallet_balance,
    transactions: recentTxns.map((t) => ({
      ...t,
      amount: t.amount,
      spend_date: t.spend_date ?? null,
      created_at: t.created_at.toISOString(),
    })),
    ad_accounts: adAccountsList,
  };

  return (
    <ClientTabs
      client={clientData}
      affiliates={affiliateList}
      suppliers={suppliersWithSubs}
      canCredit={canCredit}
      topupRequests={topupRequestRows}
      adAccountOptions={adAccountOptions}
    />
  );
}
