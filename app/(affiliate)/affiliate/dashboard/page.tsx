"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  paused: "bg-amber-50 text-amber-700 border border-amber-200",
  churned: "bg-gray-100 text-gray-500",
};

interface DashboardData {
  total_clients: number;
  active_clients: number;
  current_month_commission: number;
  total_paid: number;
  pending_payment: number;
  monthly_chart: { period_year: number; period_month: number; commission_amount: number; status: string }[];
  recent_clients: { id: string; client_code: string; name: string; company: string; status: string; created_at: string }[];
}

export default function AffiliateDashboardPage() {
  const { data: session } = useSession();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["affiliate-dashboard"],
    queryFn: () => fetch("/api/affiliate/dashboard").then((r) => r.json()),
    staleTime: 0,
    refetchInterval: 60000,
  });

  const chartData = (data?.monthly_chart ?? []).map((r) => ({
    month: MONTH_NAMES[r.period_month - 1],
    amount: r.commission_amount,
  }));

  const firstName = session?.user.name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back, {firstName}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard label="Total Clients Referred" value={String(data?.total_clients ?? 0)} />
            <KpiCard label="Active Clients" value={String(data?.active_clients ?? 0)} color="text-emerald-600" />
            <KpiCard
              label="This Month's Commission"
              value={`$${fmt(data?.current_month_commission ?? 0)}`}
              sub="In progress"
              color="text-blue-600"
            />
            <KpiCard
              label="Pending Payment"
              value={`$${fmt(data?.pending_payment ?? 0)}`}
              sub="Approved — awaiting transfer"
              color={(data?.pending_payment ?? 0) > 0 ? "text-amber-600" : "text-gray-400"}
            />
            <KpiCard
              label="Total Commissions Paid"
              value={`$${fmt(data?.total_paid ?? 0)}`}
              color="text-emerald-600"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commission History Chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Commission History (Last 6 Months)</p>
          {isLoading ? (
            <div className="h-48 bg-gray-50 rounded animate-pulse" />
          ) : chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">No commission data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                <Tooltip
                  formatter={(v) => [`$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Commission"]}
                />
                <Bar dataKey="amount" fill="hsl(236,85%,55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Clients */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Recent Clients</p>
          </div>
          {isLoading ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3 animate-pulse flex items-center gap-4">
                  <div className="h-4 bg-gray-100 rounded w-20" />
                  <div className="h-4 bg-gray-100 rounded w-32" />
                  <div className="h-4 bg-gray-100 rounded w-16 ml-auto" />
                </div>
              ))}
            </div>
          ) : (data?.recent_clients ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No clients yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {(data?.recent_clients ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 text-xs">{c.name}</p>
                      <p className="text-gray-400 text-xs font-mono">{c.client_code}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400 text-right whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
