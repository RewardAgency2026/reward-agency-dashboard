"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/ui/platform-icon";

interface TransactionRow {
  id: string;
  type: string;
  amount: string;
  currency: string;
  description: string | null;
  created_at: string;
  ad_account_name: string | null;
  ad_account_platform: string | null;
}

const TYPE_TABS = [
  { value: "", label: "All" },
  { value: "payment", label: "Credit Client Wallet" },
  { value: "topup", label: "Top Up" },
  { value: "commission_fee", label: "Commission" },
  { value: "withdraw", label: "Withdraw" },
  { value: "refund", label: "Refund" },
] as const;

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

const CREDIT_TYPES = new Set(["payment"]);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function PortalTransactions() {
  const [typeFilter, setTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const queryParams = new URLSearchParams();
  if (typeFilter) queryParams.set("type", typeFilter);
  if (fromDate) queryParams.set("from", fromDate);
  if (toDate) {
    // to is exclusive end of day
    const end = new Date(toDate);
    end.setDate(end.getDate() + 1);
    queryParams.set("to", end.toISOString().split("T")[0]);
  }

  const { data: transactions = [], isLoading } = useQuery<TransactionRow[]>({
    queryKey: ["portal-transactions", typeFilter, fromDate, toDate],
    queryFn: () => fetch(`/api/portal/transactions?${queryParams}`).then((r) => r.json()),
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Type tabs */}
        <div className="border-b border-gray-200 w-full">
          <div className="flex gap-1 overflow-x-auto">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setTypeFilter(tab.value)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                  typeFilter === tab.value
                    ? "border-[hsl(236,85%,55%)] text-[hsl(236,85%,55%)]"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="text-gray-400">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] focus:border-transparent"
          />
          <span className="text-gray-400">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] focus:border-transparent"
          />
          {(fromDate || toDate) && (
            <button
              onClick={() => { setFromDate(""); setToDate(""); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No transactions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Ad Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) => {
                const isCredit = CREDIT_TYPES.has(t.type);
                return (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(t.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TYPE_BADGE[t.type] ?? "bg-gray-100 text-gray-500")}>
                        {TYPE_LABELS[t.type] ?? t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("font-mono font-medium", isCredit ? "text-emerald-600" : "text-gray-700")}>
                        {isCredit ? "+" : "−"}{parseFloat(t.amount).toFixed(2)}
                      </span>
                      <span className="ml-1 text-xs text-gray-400">{t.currency}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{t.description ?? "—"}</td>
                    <td className="px-4 py-3">
                      {t.ad_account_name ? (
                        <div className="flex items-center gap-1.5">
                          {t.ad_account_platform && <PlatformIcon platform={t.ad_account_platform} size={16} />}
                          <span className="text-gray-600">{t.ad_account_name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
