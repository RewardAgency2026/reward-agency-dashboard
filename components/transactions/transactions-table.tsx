"use client";

import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/ui/platform-icon";

export interface TransactionRow {
  id: string;
  client_name: string | null;
  client_code: string | null;
  type: string;
  amount: string;
  currency: string;
  is_crypto: boolean;
  crypto_fee_amount: string;
  supplier_fee_amount: string;
  top_up_fee_amount: string;
  description: string | null;
  ad_account_name: string | null;
  ad_account_platform: string | null;
  created_by_name: string | null;
  created_at: string;
}

interface Props {
  transactions: TransactionRow[];
  isLoading: boolean;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  currencyFilter: string;
  setCurrencyFilter: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
}

const TYPE_TABS = [
  { value: "", label: "All" },
  { value: "payment", label: "Payment" },
  { value: "topup", label: "Top Up" },
  { value: "commission_fee", label: "Commission Fee" },
  { value: "withdraw", label: "Withdraw" },
  { value: "refund", label: "Refund" },
  { value: "spend_record", label: "Spend Record" },
] as const;

const TYPE_BADGE: Record<string, string> = {
  payment: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  topup: "bg-blue-50 text-blue-700 border border-blue-200",
  commission_fee: "bg-orange-50 text-orange-700 border border-orange-200",
  withdraw: "bg-orange-50 text-orange-700 border border-orange-200",
  refund: "bg-red-50 text-red-700 border border-red-200",
  spend_record: "bg-gray-100 text-gray-600",
};

const TYPE_LABELS: Record<string, string> = {
  payment: "Payment",
  topup: "Top Up",
  commission_fee: "Commission Fee",
  withdraw: "Withdraw",
  refund: "Refund",
  spend_record: "Spend Record",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function exportCSV(rows: TransactionRow[]) {
  const headers = [
    "Date", "Client Code", "Client Name", "Type", "Amount", "Currency",
    "Description", "Ad Account", "Platform", "Is Crypto", "Crypto Fee",
    "Supplier Fee", "Commission Fee", "Gross Margin", "Created By",
  ];

  const csvRows = rows.map((r) => [
    new Date(r.created_at).toLocaleDateString("en-GB"),
    r.client_code ?? "",
    r.client_name ?? "",
    r.type,
    parseFloat(r.amount).toFixed(2),
    r.currency,
    r.description ?? "",
    r.ad_account_name ?? "",
    r.ad_account_platform ?? "",
    r.is_crypto ? "Yes" : "No",
    parseFloat(r.crypto_fee_amount).toFixed(2),
    parseFloat(r.supplier_fee_amount).toFixed(2),
    parseFloat(r.top_up_fee_amount).toFixed(2),
    (parseFloat(r.top_up_fee_amount) - parseFloat(r.supplier_fee_amount)).toFixed(2),
    r.created_by_name ? r.created_by_name.split(" ")[0] : "",
  ]);

  const csv = [headers, ...csvRows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-4 py-3 animate-pulse flex items-center gap-4">
            <div className="h-4 bg-gray-100 rounded w-24" />
            <div className="h-4 bg-gray-100 rounded w-32" />
            <div className="h-4 bg-gray-100 rounded w-20" />
            <div className="h-4 bg-gray-100 rounded w-16 ml-auto" />
            <div className="h-4 bg-gray-100 rounded w-24" />
            <div className="h-4 bg-gray-100 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TransactionsTable({
  transactions,
  isLoading,
  typeFilter,
  setTypeFilter,
  currencyFilter,
  setCurrencyFilter,
  search,
  setSearch,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}: Props) {
  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search client, code, description..."
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] w-64"
        />
        <select
          value={currencyFilter}
          onChange={(e) => setCurrencyFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
        >
          <option value="">All Currencies</option>
          <option value="USD">USD</option>
          <option value="USDT">USDT</option>
          <option value="USDC">USDC</option>
          <option value="EUR">EUR</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
        />
        <span className="text-sm text-gray-400">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
        />
        <button
          onClick={() => exportCSV(transactions)}
          className="ml-auto rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Type tabs */}
      <div className="border-b border-gray-200 mb-4">
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

      {isLoading ? (
        <TableSkeleton />
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white">
          <p className="text-sm text-gray-400 text-center py-16">No transactions found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Ad Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(t.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{t.client_name ?? "—"}</p>
                    <p className="text-xs font-mono text-gray-400">{t.client_code ?? ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TYPE_BADGE[t.type] ?? "bg-gray-100 text-gray-600")}>
                      {TYPE_LABELS[t.type] ?? t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-mono font-medium text-gray-900">{parseFloat(t.amount).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{t.currency}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{t.description ?? "—"}</td>
                  <td className="px-4 py-3">
                    {t.ad_account_platform || t.ad_account_name ? (
                      <div className="flex items-center gap-1.5">
                        {t.ad_account_platform && <PlatformIcon platform={t.ad_account_platform} size={16} />}
                        <span className="text-gray-700 text-xs">{t.ad_account_name ?? "—"}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {t.created_by_name ? t.created_by_name.split(" ")[0] : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 px-4 py-2">
            <p className="text-xs text-gray-400">Showing {transactions.length} transactions</p>
          </div>
        </div>
      )}
    </div>
  );
}
