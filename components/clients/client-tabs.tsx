"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { EditClientModal } from "./edit-client-modal";
import { CreditModal } from "./credit-modal";

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
  status: string;
}

interface Client {
  id: string;
  client_code: string;
  name: string;
  email: string;
  company: string;
  status: string;
  balance_model: string;
  billing_currency: string;
  billing_address?: string | null;
  crypto_fee_rate: string;
  affiliate_id: string | null;
  affiliate_name: string | null;
  affiliate_code: string | null;
  onboarding_source: string;
  created_at: string;
  wallet_balance: number;
  transactions: Transaction[];
  ad_accounts: AdAccount[];
}

interface Props {
  client: Client;
  affiliates: Affiliate[];
  canCredit: boolean;
}

const TABS = ["Overview", "Ad Accounts", "Transactions", "Top-Up Requests"] as const;

const TXN_TYPE_BADGE: Record<string, string> = {
  payment: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  topup: "bg-blue-50 text-blue-700 border border-blue-200",
  withdraw: "bg-amber-50 text-amber-700 border border-amber-200",
  refund: "bg-purple-50 text-purple-700 border border-purple-200",
  spend_record: "bg-gray-100 text-gray-600",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  paused: "bg-amber-50 text-amber-700 border border-amber-200",
  churned: "bg-red-50 text-red-700 border border-red-200",
  closed: "bg-gray-100 text-gray-500",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ClientTabs({ client, affiliates, canCredit }: Props) {
  const [tab, setTab] = useState<typeof TABS[number]>("Overview");

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-sm text-gray-500">{client.client_code}</span>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[client.status] ?? "bg-gray-100 text-gray-600")}>
            {client.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Tab content */}
      {tab === "Overview" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
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
      )}

      {tab === "Ad Accounts" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          {client.ad_accounts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No ad accounts yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Platform", "Account ID", "Account Name", "Status"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {client.ad_accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 capitalize">{a.platform}</td>
                    <td className="px-4 py-2 font-mono text-xs">{a.account_id}</td>
                    <td className="px-4 py-2">{a.account_name}</td>
                    <td className="px-4 py-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[a.status] ?? "bg-gray-100 text-gray-500")}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

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
                    <td className="px-4 py-3 font-mono">{parseFloat(t.amount).toFixed(2)}</td>
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

      {tab === "Top-Up Requests" && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-400 text-center py-8">Top-Up Requests — coming in Sprint 4.</p>
        </div>
      )}
    </div>
  );
}
