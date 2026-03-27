import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { clients, ad_accounts, transactions, topup_requests } from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { calculateWalletBalance } from "@/lib/balance";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/ui/platform-icon";

const TYPE_BADGE: Record<string, string> = {
  payment: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  topup: "bg-blue-50 text-blue-700 border border-blue-200",
  commission_fee: "bg-orange-50 text-orange-700 border border-orange-200",
  withdraw: "bg-red-50 text-red-600 border border-red-200",
  refund: "bg-red-50 text-red-600 border border-red-200",
  spend_record: "bg-gray-100 text-gray-500 border border-gray-200",
};

const TYPE_LABELS: Record<string, string> = {
  payment: "Credit Client Wallet",
  topup: "Top Up",
  commission_fee: "Commission",
  withdraw: "Withdrawal",
  refund: "Refund",
  spend_record: "Spend Record",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  approved: "bg-blue-50 text-blue-700 border border-blue-200",
  insufficient_funds: "bg-red-50 text-red-600 border border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  insufficient_funds: "Insufficient Funds",
};

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ClientDashboardPage() {
  const session = await auth();
  if (!session || session.user.userType !== "client") redirect("/login");

  const clientId = session.user.id;

  const [client] = await db
    .select({
      name: clients.name,
      client_code: clients.client_code,
      balance_model: clients.balance_model,
      billing_currency: clients.billing_currency,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) redirect("/login");

  const walletBalance = await calculateWalletBalance(clientId, client.balance_model);

  const [countRow] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(ad_accounts)
    .where(and(eq(ad_accounts.client_id, clientId), eq(ad_accounts.status, "active")));

  const recentTransactions = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
      description: transactions.description,
      created_at: transactions.created_at,
      ad_account_name: ad_accounts.account_name,
      ad_account_platform: ad_accounts.platform,
    })
    .from(transactions)
    .leftJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
    .where(eq(transactions.client_id, clientId))
    .orderBy(desc(transactions.created_at))
    .limit(5);

  const pendingTopups = await db
    .select({
      id: topup_requests.id,
      amount: topup_requests.amount,
      currency: topup_requests.currency,
      status: topup_requests.status,
      created_at: topup_requests.created_at,
      ad_account_name: ad_accounts.account_name,
      ad_account_platform: ad_accounts.platform,
    })
    .from(topup_requests)
    .leftJoin(ad_accounts, eq(topup_requests.ad_account_id, ad_accounts.id))
    .where(
      and(
        eq(topup_requests.client_id, clientId),
        inArray(topup_requests.status, ["pending", "approved", "insufficient_funds"])
      )
    )
    .orderBy(desc(topup_requests.created_at))
    .limit(3);

  const activeCount = Number(countRow?.count ?? 0);

  return (
    <div className="space-y-6">
      {/* Welcome card */}
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Welcome back, {client.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Here's an overview of your account.</p>
        </div>
        <span className="rounded-full bg-[hsl(236,85%,95%)] text-[hsl(236,85%,55%)] px-3 py-1 text-sm font-mono font-medium">
          {client.client_code}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 col-span-2 md:col-span-1">
          <p className="text-xs text-gray-500 mb-1">Wallet Balance</p>
          <p className={cn("text-2xl font-bold", walletBalance > 0 ? "text-emerald-600" : "text-red-500")}>
            ${walletBalance.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs text-gray-500 mb-1">Currency</p>
          <p className="text-2xl font-bold text-gray-900">{client.billing_currency}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs text-gray-500 mb-1">Balance Model</p>
          <p className="text-2xl font-bold text-gray-900 capitalize">{client.balance_model}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs text-gray-500 mb-1">Active Ad Accounts</p>
          <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent Transactions</h2>
            <Link href="/portal/transactions" className="text-xs text-[hsl(236,85%,55%)] hover:underline">
              View all
            </Link>
          </div>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No transactions yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentTransactions.map((t) => (
                <div key={t.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TYPE_BADGE[t.type] ?? "bg-gray-100 text-gray-500")}>
                      {TYPE_LABELS[t.type] ?? t.type}
                    </span>
                    <div>
                      <p className="text-sm text-gray-700">{t.description ?? (t.ad_account_name ?? "—")}</p>
                      <p className="text-xs text-gray-400">{formatDate(t.created_at)}</p>
                    </div>
                  </div>
                  <span className={cn("font-mono text-sm font-medium", t.type === "payment" ? "text-emerald-600" : "text-gray-700")}>
                    {t.type === "payment" ? "+" : "−"}{parseFloat(t.amount).toFixed(2)} {t.currency}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Active Top Ups */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Active Top Ups</h2>
              <Link href="/portal/topups" className="text-xs text-[hsl(236,85%,55%)] hover:underline">
                View all
              </Link>
            </div>
            {pendingTopups.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No pending top ups.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingTopups.map((t) => (
                  <div key={t.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {t.ad_account_platform && <PlatformIcon platform={t.ad_account_platform} size={14} />}
                        <span className="text-sm text-gray-700 truncate max-w-[120px]">{t.ad_account_name ?? "—"}</span>
                      </div>
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {parseFloat(t.amount).toFixed(2)} {t.currency}
                      </span>
                    </div>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE[t.status] ?? "bg-gray-100 text-gray-500")}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
            <Link
              href="/portal/topups"
              className="block w-full rounded-lg px-4 py-2 text-center text-sm font-medium bg-[hsl(236,85%,55%)] text-white hover:bg-[hsl(236,85%,50%)] transition-colors"
            >
              Submit Top Up Request
            </Link>
            <Link
              href="/portal/transactions"
              className="block w-full rounded-lg px-4 py-2 text-center text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              View All Transactions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
