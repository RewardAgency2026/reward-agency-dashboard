"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditClientModal } from "./edit-client-modal";
import { CreditModal } from "./credit-modal";
import { WithdrawModal } from "./withdraw-modal";
import { AddAdAccountModal } from "@/components/ad-accounts/add-ad-account-modal";
import { TopupRequestsTable, type TopupRequestRow } from "@/components/topup-requests/topup-requests-table";
import { NewRequestModal } from "@/components/topup-requests/new-request-modal";

interface Affiliate {
  id: string;
  name: string;
  affiliate_code: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  currency: string;
  is_crypto: boolean;
  description: string | null;
  spend_date: string | null;
  created_at: string;
}

interface AdAccount {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  top_up_fee_rate: string;
  status: string;
  supplier_id: string;
  supplier_sub_account_id: string | null;
}

interface SupplierOption {
  id: string;
  name: string;
  sub_accounts: Array<{ id: string; name: string; platform_fees: Record<string, number> }>;
}

type PlatformFees = { meta: number; google: number; tiktok: number; snapchat: number; pinterest: number };

interface Client {
  id: string;
  client_code: string;
  name: string;
  email: string;
  company: string;
  status: string;
  balance_model: string;
  billing_currency: string;
  crypto_fee_rate: string;
  affiliate_id: string | null;
  affiliate_name: string | null;
  affiliate_code: string | null;
  onboarding_source: string;
  notes: string | null;
  has_setup: boolean;
  setup_monthly_fee: string | null;
  setup_monthly_cost: string | null;
  client_platform_fees: PlatformFees | null;
  created_at: string;
  wallet_balance: number;
  transactions: Transaction[];
  ad_accounts: AdAccount[];
}

interface AdAccountOption {
  id: string;
  client_id: string;
  platform: string;
  account_name: string;
  status: string;
}

interface Props {
  client: Client;
  affiliates: Affiliate[];
  suppliers: SupplierOption[];
  canCredit: boolean;
  topupRequests: TopupRequestRow[];
  adAccountOptions: AdAccountOption[];
}

const TABS = ["Overview", "Ad Accounts", "Transactions", "Top Ups"] as const;

// payment → green (+), topup/withdraw/refund/spend_record → deduction colors
const TXN_TYPE_BADGE: Record<string, string> = {
  payment: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  topup: "bg-blue-50 text-blue-700 border border-blue-200",
  withdraw: "bg-orange-50 text-orange-700 border border-orange-200",
  refund: "bg-red-50 text-red-700 border border-red-200",
  spend_record: "bg-gray-100 text-gray-600",
};

const TXN_AMOUNT_COLOR: Record<string, string> = {
  payment: "text-emerald-600",
  topup: "text-blue-600",
  withdraw: "text-orange-600",
  refund: "text-red-600",
  spend_record: "text-gray-500",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  paused: "bg-amber-50 text-amber-700 border border-amber-200",
  churned: "bg-red-50 text-red-700 border border-red-200",
  closed: "bg-gray-100 text-gray-500",
};

const AD_ACCOUNT_STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  disabled: "bg-amber-50 text-amber-700 border border-amber-200",
  deleted: "bg-red-50 text-red-600 border border-red-200",
};

const PLATFORM_LABELS: Record<keyof PlatformFees, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", pinterest: "Pinterest",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatAmount(txn: Transaction) {
  const val = parseFloat(txn.amount);
  const isDebit = txn.type !== "payment";
  return `${isDebit ? "−" : "+"}${val.toFixed(2)}`;
}

export function ClientTabs({ client, affiliates, suppliers, canCredit, topupRequests, adAccountOptions }: Props) {
  const [tab, setTab] = useState<typeof TABS[number]>("Overview");

  return (
    <div>
      {/* Back link */}
      <Link href="/clients" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-4">
        <ArrowLeft size={13} />
        Back to Clients
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-sm text-gray-500">{client.client_code}</span>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[client.status] ?? "bg-gray-100 text-gray-600")}>
            {client.status}
          </span>
          {client.has_setup && (
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
              Setup
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <WithdrawModal clientId={client.id} walletBalance={client.wallet_balance} canWithdraw={canCredit} />
          <CreditModal clientId={client.id} cryptoFeeRate={parseFloat(client.crypto_fee_rate)} canCredit={canCredit} />
          <EditClientModal client={client} affiliates={affiliates} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Wallet Balance</p>
          <p className={cn("text-xl font-bold font-mono", client.wallet_balance > 0 ? "text-emerald-600" : "text-red-500")}>
            {client.wallet_balance.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{client.billing_currency}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Balance Model</p>
          <p className="text-base font-semibold text-gray-800 capitalize">{client.balance_model}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Currency</p>
          <p className="text-base font-semibold text-gray-800">{client.billing_currency}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Affiliate</p>
          <p className="text-base font-semibold text-gray-800">{client.affiliate_name ?? "—"}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t
                  ? "border-[hsl(236,85%,55%)] text-[hsl(236,85%,55%)]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      {tab === "Overview" && (
        <div className="space-y-6">
          {/* Core info */}
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Client Details</h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { label: "Name", value: client.name },
                { label: "Email", value: client.email },
                { label: "Company", value: client.company || "—" },
                { label: "Balance Model", value: <span className="capitalize">{client.balance_model}</span> },
                { label: "Billing Currency", value: client.billing_currency },
                { label: "Crypto Fee Rate", value: `${parseFloat(client.crypto_fee_rate)}%` },
                { label: "Onboarding Source", value: <span className="capitalize">{client.onboarding_source}</span> },
                { label: "Affiliate", value: client.affiliate_name ? `${client.affiliate_name} (${client.affiliate_code})` : "—" },
                { label: "Created", value: formatDate(client.created_at) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-gray-500">{label}</dt>
                  <dd className="mt-1 text-sm text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}

          {/* Setup fees */}
          {client.has_setup && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-6">
              <h3 className="text-sm font-semibold text-purple-800 mb-4">Setup Configuration</h3>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-medium text-purple-600">Monthly Fee (client)</dt>
                  <dd className="mt-1 text-sm font-semibold text-purple-900 font-mono">
                    {client.setup_monthly_fee ? `$${parseFloat(client.setup_monthly_fee).toFixed(2)}` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-purple-600">Monthly Cost (internal)</dt>
                  <dd className="mt-1 text-sm font-semibold text-purple-900 font-mono">
                    {client.setup_monthly_cost ? `$${parseFloat(client.setup_monthly_cost).toFixed(2)}` : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Platform fees */}
          {client.client_platform_fees && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Platform Top-Up Fees</h3>
              <div className="grid grid-cols-5 gap-4">
                {(Object.keys(PLATFORM_LABELS) as (keyof PlatformFees)[]).map((p) => {
                  const rate = client.client_platform_fees![p] ?? 0;
                  return (
                    <div key={p} className="text-center">
                      <p className="text-xs font-medium text-gray-500 mb-1">{PLATFORM_LABELS[p]}</p>
                      <p className={cn("text-sm font-semibold font-mono", rate > 0 ? "text-gray-900" : "text-gray-400")}>
                        {rate}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ad Accounts */}
      {tab === "Ad Accounts" && (
        <div>
          {canCredit && (
            <div className="mb-4 flex justify-end">
              <AddAdAccountModal
                clients={[{ id: client.id, name: client.name, client_code: client.client_code, client_platform_fees: client.client_platform_fees }]}
                suppliers={suppliers}
                prefillClientId={client.id}
                label="Add Ad Account"
              />
            </div>
          )}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            {client.ad_accounts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No ad accounts yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Platform", "Account", "Fee Rate", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {client.ad_accounts.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 capitalize">{a.platform}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{a.account_name}</p>
                        <p className="text-xs font-mono text-gray-400">{a.account_id}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">{parseFloat(a.top_up_fee_rate)}%</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", AD_ACCOUNT_STATUS_BADGE[a.status] ?? "bg-gray-100 text-gray-500")}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Transactions */}
      {tab === "Transactions" && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {client.transactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No transactions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Type", "Amount", "Currency", "Date", "Description"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {client.transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", TXN_TYPE_BADGE[t.type] ?? "bg-gray-100 text-gray-600")}>
                        {t.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 font-mono font-medium", TXN_AMOUNT_COLOR[t.type] ?? "text-gray-700")}>
                      {formatAmount(t)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.currency}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {t.spend_date ? formatDate(t.spend_date) : formatDate(t.created_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{t.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "Top Ups" && (
        <div>
          {canCredit && (
            <div className="mb-4 flex justify-end">
              <NewRequestModal
                clients={[{
                  id: client.id,
                  name: client.name,
                  client_code: client.client_code,
                  balance_model: client.balance_model,
                  billing_currency: client.billing_currency,
                  wallet_balance: client.wallet_balance,
                }]}
                adAccounts={adAccountOptions}
                prefillClientId={client.id}
                label="New Top-Up"
              />
            </div>
          )}
          <TopupRequestsTable
            requests={topupRequests}
            isAdmin={canCredit}
            hideClientColumn
          />
        </div>
      )}
    </div>
  );
}
