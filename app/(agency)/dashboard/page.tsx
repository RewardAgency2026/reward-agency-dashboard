"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 animate-pulse">
      <div className="h-3 bg-gray-100 rounded w-24 mb-2" />
      <div className="h-8 bg-gray-100 rounded w-32" />
    </div>
  );
}

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TRANSACTION_COLORS: Record<string, string> = {
  payment: "text-emerald-600",
  topup: "text-blue-600",
  commission_fee: "text-orange-600",
  withdraw: "text-orange-600",
  refund: "text-red-600",
  spend_record: "text-gray-500",
};

const TRANSACTION_LABELS: Record<string, string> = {
  payment: "Credit Client Wallet",
  topup: "Top Up",
  commission_fee: "Commission Fee",
  withdraw: "Withdraw",
  refund: "Refund",
  spend_record: "Spend Record",
};

interface RecentTransaction {
  id: string;
  type: string;
  amount: string;
  currency: string;
  description: string | null;
  client_name: string | null;
  client_code: string | null;
  ad_account_platform: string | null;
  created_at: string;
}

interface DashboardKpis {
  total_wallet_balance: number;
  monthly_topups: number;
  monthly_commissions: number;
  monthly_provider_fees: number;
  gross_margin: number;
  active_clients: number;
  pending_topups: number;
  insufficient_topups: number;
  active_ad_accounts: number;
  total_affiliates: number;
  agency_users: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetch("/api/dashboard").then((r) => r.json()),
    refetchInterval: 60000,
    staleTime: 0,
  });

  const kpis: DashboardKpis | undefined = data?.kpis;
  const dailyVolume: { date: string; total: number }[] = data?.daily_volume ?? [];
  const platformVolume: { platform: string; total: number }[] = data?.platform_volume ?? [];
  const recentTxns: RecentTransaction[] = data?.recent_transactions ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Welcome back, {session?.user.name?.split(" ")[0] ?? ""}
        </p>
      </div>

      {/* Row 1 — Financial KPIs */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Financial (this month)</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <KpiCard label="Total Wallet Balances" value={`$${formatMoney(kpis?.total_wallet_balance ?? 0)}`} />
              <KpiCard label="Top Ups This Month" value={`$${formatMoney(kpis?.monthly_topups ?? 0)}`} />
              <KpiCard label="Client Commissions" value={`$${formatMoney(kpis?.monthly_commissions ?? 0)}`} color="text-emerald-600" />
              <KpiCard label="Provider Fees" value={`$${formatMoney(kpis?.monthly_provider_fees ?? 0)}`} color="text-red-500" />
              <KpiCard label="Gross Margin" value={`$${formatMoney(kpis?.gross_margin ?? 0)}`} color={(kpis?.gross_margin ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"} />
            </>
          )}
        </div>
      </div>

      {/* Row 2 — Operational KPIs */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Operational</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <KpiCard label="Active Clients" value={String(kpis?.active_clients ?? 0)} />
              <Link href="/topup-requests">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 cursor-pointer hover:bg-amber-100 transition-colors">
                  <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Pending Top Ups</p>
                  <p className="mt-1 text-2xl font-bold text-amber-700">{kpis?.pending_topups ?? 0}</p>
                </div>
              </Link>
              <KpiCard label="Active Ad Accounts" value={String(kpis?.active_ad_accounts ?? 0)} />
              <KpiCard label="Total Affiliates" value={String(kpis?.total_affiliates ?? 0)} />
            </>
          )}
        </div>
      </div>

      {/* End-of-Day Checklist */}
      {!isLoading && ((kpis?.pending_topups ?? 0) > 0 || (kpis?.insufficient_topups ?? 0) > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-800 mb-3">End-of-Day Checklist</p>
          <div className="space-y-2">
            {(kpis?.pending_topups ?? 0) > 0 && (
              <Link href="/topup-requests?status=pending" className="flex items-center justify-between rounded-lg bg-white border border-amber-200 px-4 py-2 hover:bg-amber-50 transition-colors">
                <span className="text-sm text-amber-800">Pending top ups awaiting execution</span>
                <span className="text-sm font-bold text-amber-700">{kpis?.pending_topups}</span>
              </Link>
            )}
            {(kpis?.insufficient_topups ?? 0) > 0 && (
              <Link href="/topup-requests?status=insufficient_funds" className="flex items-center justify-between rounded-lg bg-white border border-red-200 px-4 py-2 hover:bg-red-50 transition-colors">
                <span className="text-sm text-red-700">Top ups with insufficient funds</span>
                <span className="text-sm font-bold text-red-700">{kpis?.insufficient_topups}</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily volume line chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Daily Top-Up Volume (Last 30 Days)</p>
          {isLoading ? (
            <div className="h-48 bg-gray-50 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d) => new Date(String(d)).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
                />
                <Tooltip
                  formatter={(v) => [`$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Volume"]}
                  labelFormatter={(d) => new Date(String(d)).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                />
                <Line type="monotone" dataKey="total" stroke="hsl(236,85%,55%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Platform bar chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Top Ups by Platform (This Month)</p>
          {isLoading ? (
            <div className="h-48 bg-gray-50 rounded animate-pulse" />
          ) : platformVolume.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">No data this month</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={platformVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                <Tooltip formatter={(v) => [`$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Volume"]} />
                <Bar dataKey="total" fill="hsl(236,85%,55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Recent Transactions</p>
          <Link href="/transactions" className="text-xs text-[hsl(236,85%,55%)] hover:underline">View all</Link>
        </div>
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3 animate-pulse flex items-center gap-4">
                <div className="h-4 bg-gray-100 rounded w-24" />
                <div className="h-4 bg-gray-100 rounded w-32" />
                <div className="h-4 bg-gray-100 rounded w-16 ml-auto" />
              </div>
            ))}
          </div>
        ) : recentTxns.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No transactions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {recentTxns.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900 text-xs">{t.client_name}</p>
                    <p className="text-gray-400 text-xs font-mono">{t.client_code}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium ${TRANSACTION_COLORS[t.type] ?? "text-gray-600"}`}>
                      {TRANSACTION_LABELS[t.type] ?? t.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <p className="font-mono text-sm font-medium text-gray-900">{parseFloat(t.amount).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{t.currency}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
